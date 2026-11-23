/**
 * الاشتراكات والفوترة (القسم 12) — حدود الباقات مفروضة في الخدمات.
 * الدفع خلف واجهة قابلة للاستبدال: وضع stub للتطوير، ومزود معتمد + webhook موقع للإنتاج.
 * الأسعار مقترحات اختبار سوق وليست التزامًا تسعيريًا (حسب الوثيقة).
 */
import { newId, nowIso } from "@/lib/db";
import { err } from "@/lib/errors";
import type { Ctx } from "@/lib/types";
import { requireOrgRole } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { PLANS_SEED } from "@/lib/plans";

export function listPlans() {
  return PLANS_SEED;
}

export async function getSubscription(ctx: Ctx) {
  const sub = (await ctx.db.get(
    `SELECT s.*, p.name_ar plan_name, p.price_monthly_sar, p.max_active_events, p.max_guests_per_event, p.max_delegates_per_event, p.storage_mb
     FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.organization_id = ?`,
    ctx.actor.orgId
  ));
  const invoices = (await ctx.db.all(
    "SELECT * FROM invoices WHERE organization_id = ? ORDER BY issued_at DESC LIMIT 50", ctx.actor.orgId
  ));
  const usage = (await ctx.db.get(
    `SELECT
      (SELECT COUNT(*) FROM events WHERE organization_id = ? AND status NOT IN ('archived','cancelled','ended')) active_events,
      (SELECT COALESCE(SUM(bytes),0) FROM media_assets WHERE organization_id = ? AND status = 'active') storage_bytes`,
    ctx.actor.orgId, ctx.actor.orgId
  ));
  return { subscription: sub, invoices, usage };
}

/** واجهة مزود الدفع — قابلة للاستبدال (Moyasar/Stripe/Tap...) */
export interface PaymentProvider {
  checkout(input: { orgId: string; planId: string; cycle: string; amountSar: number }): Promise<{ providerRef: string; paid: boolean }>;
  verifyWebhook(payload: string, signature: string): boolean;
}

class StubProvider implements PaymentProvider {
  async checkout(input: { orgId: string; planId: string; cycle: string; amountSar: number }) {
    // محاكاة محلية فقط — لا حركة مالية حقيقية
    return { providerRef: `stub_${newId()}`, paid: true };
  }
  verifyWebhook(_payload: string, signature: string): boolean {
    return signature === (process.env.DAWAT_SECRET ?? "");
  }
}

export function getProvider(): PaymentProvider {
  const mode = process.env.DAWAT_PAYMENT_MODE ?? "stub";
  if (mode === "stub") return new StubProvider();
  // الإنتاج: تنفيذ مزود معتمد هنا مع فصل بيانات البطاقات عن الخادم
  err("NOT_IMPLEMENTED", "مزود الدفع الحقيقي غير مهيأ — اضبط DAWAT_PAYMENT_MODE");
}

export async function checkout(ctx: Ctx, planId: string, cycle: "monthly" | "yearly") {
  requireOrgRole(ctx, ["owner"]);
  const plan = PLANS_SEED.find((p) => p.id === planId);
  if (!plan) err("VALIDATION", "باقة غير معروفة");
  if (!["monthly", "yearly"].includes(cycle)) err("VALIDATION", "دورة فوترة غير صالحة");
  const amount = cycle === "yearly" ? plan.price_monthly_sar * 10 : plan.price_monthly_sar; // سنة = 10 أشهر (خصم تجريبي)
  const provider = getProvider();
  const result = await provider.checkout({ orgId: ctx.actor.orgId, planId, cycle, amountSar: amount });

  return (await ctx.db.tx(async () => {
    const sub = (await ctx.db.get<any>("SELECT * FROM subscriptions WHERE organization_id = ?", ctx.actor.orgId));
    const renewal = new Date(Date.now() + (cycle === "yearly" ? 365 : 30) * 864e5).toISOString();
    if (sub) {
      (await ctx.db.run(
        "UPDATE subscriptions SET plan_id = ?, state = 'active', billing_cycle = ?, renewal_at = ? WHERE id = ?",
        planId, cycle, renewal, sub.id
      ));
    } else {
      (await ctx.db.run(
        "INSERT INTO subscriptions (id, organization_id, plan_id, state, billing_cycle, renewal_at) VALUES (?,?,?,'active',?,?)",
        newId(), ctx.actor.orgId, planId, cycle, renewal
      ));
    }
    (await ctx.db.run("UPDATE organizations SET plan_id = ? WHERE id = ?", planId, ctx.actor.orgId));
    const invoiceId = newId();
    (await ctx.db.run(
      `INSERT INTO invoices (id, subscription_id, organization_id, amount_sar, tax_sar, status, provider_ref, paid_at)
       VALUES (?,?,?,?,0,?,?,?)`,
      invoiceId, sub?.id ?? (await ctx.db.get<any>("SELECT id FROM subscriptions WHERE organization_id = ?", ctx.actor.orgId))!.id,
      ctx.actor.orgId, amount, result.paid ? "paid" : "pending", result.providerRef, result.paid ? nowIso() : null
    ));
    (await writeAudit(ctx.db, {
      orgId: ctx.actor.orgId, actorId: ctx.actor.user.id,
      action: "billing.checkout", objectType: "subscription", objectId: ctx.actor.orgId,
      detail: { plan: planId, cycle, amount, provider_ref: result.providerRef }, ip: ctx.ip,
    }));
    return { ok: true, plan: planId, invoice_id: invoiceId, paid: result.paid };
  }));
}

/** webhook الدفع — تحقق توقيع إلزامي (القسم 11) */
export async function handlePaymentWebhook(db: any, payload: string, signature: string) {
  const provider = getProvider();
  if (!provider.verifyWebhook(payload, signature)) err("FORBIDDEN", "توقيع webhook غير صالح");
  let data: any;
  try { data = JSON.parse(payload); } catch { err("VALIDATION", "حمولة غير صالحة"); }
  if (data?.type === "payment.succeeded" && data.invoice_id) {
    (await db.run("UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?", nowIso(), data.invoice_id));
  }
  return { ok: true };
}
