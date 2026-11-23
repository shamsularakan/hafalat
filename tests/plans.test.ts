/** حدود الباقات والترقية (القسم 12) */
import { describe, it, expect } from "vitest";
import { setup, publishedEvent, addGuests, expectAppErrorAsync } from "./helpers";
import { createEvent } from "@/server/services/events";
import { createGuest } from "@/server/services/guests";
import { checkout, getSubscription } from "@/server/services/billing";
import { createDelegation } from "@/server/services/delegations";

describe("حدود الباقة المجانية", async () => {
  it("مناسبة واحدة نشطة فقط", async () => {
    const { a } = (await setup());
    (await publishedEvent(a.ctx));
    await expectAppErrorAsync(async () => (await createEvent(a.ctx, { title: "ثانية", type: "birthday", capacity: 10 })), "PLAN_LIMIT");
  });

  it("30 ضيفًا كحد أقصى", async () => {
    const { a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    (await addGuests(a.ctx, ev.id, 30));
    await expectAppErrorAsync(async () => (await createGuest(a.ctx, ev.id, { name: "واحد زيادة", phone: "+966599999999" })), "PLAN_LIMIT");
  });

  it("مفوّض واحد كحد أقصى", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    (await createDelegation(a.ctx, ev.id, { invitee_name: "أول", quota: 2 }));
    await expectAppErrorAsync(async () => (await createDelegation(a.ctx, ev.id, { invitee_name: "ثانٍ", quota: 2 })), "PLAN_LIMIT");
  });
});

describe("الترقية تفتح الحدود", async () => {
  it("(await checkout (وضع stub)) يرفع الباقة ويسمح بمناسبات أكثر", async () => {
    const { a } = (await setup());
    (await publishedEvent(a.ctx));
    const res = await checkout(a.ctx, "basic", "monthly");
    expect(res.paid).toBe(true);
    const ev2 = (await createEvent(a.ctx, { title: "ثانية", type: "birthday", capacity: 10 }));
    expect(ev2.id).toBeTruthy();
    const sub = (await getSubscription(a.ctx));
    expect(sub.subscription!.plan_id).toBe("basic");
    expect(sub.invoices.length).toBe(1);
    expect(sub.invoices[0].status).toBe("paid");
    expect(sub.invoices[0].amount_sar).toBe(49);
  });

  it("عضو عادي لا يستطيع الفوترة", async () => {
    const { db, a, b } = (await setup());
    (await db.run("INSERT INTO organization_members (organization_id, user_id, role) VALUES (?,?,'member')", a.orgId, b.user.id));
    const memberCtx = { ...b.ctx, orgId: a.orgId, actor: { ...b.ctx.actor, orgId: a.orgId, orgRole: "member" as const } };
    await expectAppErrorAsync(async () => (await checkout(memberCtx, "pro", "monthly")), "FORBIDDEN");
  });
});
