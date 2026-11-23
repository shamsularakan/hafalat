"use client";
import * as React from "react";
import { CreditCard, Check, HardDrive, CalendarDays } from "lucide-react";
import { api } from "@/lib/client";
import { PLANS_SEED } from "@/lib/seeds";
import { formatNumber, formatDateShort, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TH, TD, TR } from "@/components/ui/table";
import { Loading, ErrorState, useToast } from "@/components/ui/feedback";

export default function BillingPage() {
  const { show, node } = useToast();
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api.get<any>("/api/billing").then(setData).catch((e) => setError(e.message));
  }, []);
  React.useEffect(load, [load]);

  async function checkout(planId: string) {
    setBusy(planId);
    try {
      const res = await api.post<any>("/api/billing/checkout", { plan_id: planId, cycle: "monthly" });
      show(res.paid ? `تم تفعيل باقة «${PLANS_SEED.find((p) => p.id === planId)?.name_ar}» (محاكاة دفع محلية)` : "تم إنشاء الفاتورة");
      load();
    } catch (e: any) { show(e.message, "error"); }
    setBusy(null);
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Loading />;

  const sub = data.subscription;
  const current = sub?.plan_id ?? "free";
  const storageUsedMb = Math.round((data.usage?.storage_bytes ?? 0) / 1024 / 1024);

  return (
    <div className="space-y-6 animate-fade-up">
      {node}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><CreditCard className="h-6 w-6 text-muted" /> الفوترة والباقات</h1>
        <p className="mt-1 text-sm text-muted">
          وضع الدفع الحالي: <Badge tone="warning">محاكاة محلية (stub)</Badge> — يُستبدل بمزود معتمد قبل الإطلاق، وبيانات البطاقات لا تمر بخوادمنا.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted">الباقة الحالية</p>
          <p className="mt-1 text-xl font-extrabold">{sub?.plan_name ?? "مجانية"}</p>
          <p className="mt-1 text-xs text-muted">{sub?.billing_cycle === "yearly" ? "سنوي" : "شهري"} · التجديد: {sub?.renewal_at ? formatDateShort(sub.renewal_at) : "—"}</p>
        </Card>
        <Card>
          <p className="flex items-center gap-1.5 text-xs text-muted"><CalendarDays className="h-3.5 w-3.5" /> مناسبات نشطة</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">{formatNumber(data.usage?.active_events ?? 0)} <span className="text-sm font-medium text-muted">/ {sub?.max_active_events ?? 1}</span></p>
        </Card>
        <Card>
          <p className="flex items-center gap-1.5 text-xs text-muted"><HardDrive className="h-3.5 w-3.5" /> التخزين</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums">{storageUsedMb} <span className="text-sm font-medium text-muted">MB / {sub?.storage_mb ?? 50} MB</span></p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS_SEED.map((p) => (
          <Card key={p.id} className={cn("flex flex-col", p.id === current && "border-lime-500 ring-2 ring-lime-400/40")}>
            {p.id === current && <Badge tone="lime" className="mb-2 w-fit">باقتك الحالية</Badge>}
            <h3 className="font-bold">{p.name_ar}</h3>
            <p className="mt-1.5 text-2xl font-extrabold tabular-nums">{p.price_monthly_sar} <span className="text-xs font-medium text-muted">ر.س/شهر</span></p>
            <ul className="mt-3 flex-1 space-y-1.5 text-xs text-muted">
              <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-lime-500" /> {p.max_active_events} مناسبة نشطة</li>
              <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-lime-500" /> {formatNumber(p.max_guests_per_event)} ضيف/مناسبة</li>
              <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-lime-500" /> {p.max_delegates_per_event} مفوّض</li>
              <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-lime-500" /> {p.storage_mb >= 1024 ? `${p.storage_mb / 1024}GB` : `${p.storage_mb}MB`} تخزين</li>
              {p.advanced_templates ? <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-lime-500" /> قوالب متقدمة</li> : null}
              {p.custom_branding ? <li className="flex gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-lime-500" /> علامة مخصصة</li> : null}
            </ul>
            <Button className="mt-4 w-full" size="sm" variant={p.id === current ? "outline" : "primary"}
              disabled={p.id === current} loading={busy === p.id} onClick={() => checkout(p.id)}>
              {p.id === current ? "مفعلة" : p.price_monthly_sar === 0 ? "العودة للمجانية" : "ترقية الآن"}
            </Button>
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">الفواتير</CardTitle></CardHeader>
        {data.invoices.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">لا فواتير بعد.</p>
        ) : (
          <Table>
            <thead><tr><TH>التاريخ</TH><TH>المبلغ</TH><TH>الضريبة</TH><TH>الحالة</TH><TH>مرجع المزود</TH></tr></thead>
            <tbody>
              {data.invoices.map((i: any) => (
                <TR key={i.id}>
                  <TD className="text-xs text-muted">{formatDateShort(i.issued_at)}</TD>
                  <TD className="font-bold tabular-nums">{i.amount_sar} ر.س</TD>
                  <TD className="tabular-nums text-muted">{i.tax_sar} ر.س</TD>
                  <TD><Badge tone={i.status === "paid" ? "success" : i.status === "pending" ? "warning" : "danger"}>{i.status === "paid" ? "مدفوعة" : i.status === "pending" ? "معلقة" : i.status}</Badge></TD>
                  <TD className="text-[11px] text-muted" dir="ltr">{i.provider_ref ?? "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <p className="px-4 py-3 text-[11px] leading-5 text-muted">
          الضرائب والفوترة النظامية تُراجع مع مختص قبل الإطلاق. رسوم قنوات المراسلة (واتساب API/البريد) منفصلة عن الاشتراك وتضبط برصيد مدفوع.
        </p>
      </Card>
    </div>
  );
}
