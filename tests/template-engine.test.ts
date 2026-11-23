/** محرك القوالب الموحّد: المتغيرات الآمنة، المشاهد الافتراضية، حقن بيانات المدعو */
import { describe, it, expect } from "vitest";
import { substitute, defaultScenes } from "@/lib/invitation-engine";
import { BUILTIN_TEMPLATES } from "@/lib/seeds";
import { setup, publishedEvent } from "./helpers";
import { createGuest } from "@/server/services/guests";
import { issueInvitation } from "@/server/services/invitations";
import { getGuestPage } from "@/server/services/rsvp";

describe("محرك العرض الموحّد", () => {
  it("يستبدل المتغيرات المسموحة ويُنظّف النص من HTML والسكربت", () => {
    const vars = { "guest.name": "أحمد محمد", "event.name": "حفل زفاف" };
    expect(substitute("مرحبًا {{guest.name}} في {{event.name}}", vars)).toBe("مرحبًا أحمد محمد في حفل زفاف");
    expect(substitute("<b>نص</b>{{guest.name}}<script>alert(1)</script>", vars)).not.toContain("<");
    expect(substitute("{{unknown.var}}", vars)).toBe("");
  });

  it("يبني 5 مشاهد افتراضية من القالب", () => {
    const scenes = defaultScenes(BUILTIN_TEMPLATES[0].schema as any);
    expect(scenes.length).toBe(5);
    expect(scenes.map((s) => s.kind)).toEqual(["cover", "welcome", "details", "rsvp", "ticket"]);
    expect(scenes.every((s) => s.layers.length > 0)).toBe(true);
  });

  it("يحقن بيانات الضيف والمناسبة في صفحة الدعوة دون كشف بيانات غيره", () => {
    const { a } = setup();
    const ev = publishedEvent(a.ctx);
    const group = a.ctx.db.get<any>("SELECT id FROM guest_groups WHERE event_id = ? AND name = 'عائلات'", ev.id)!;
    const g1 = createGuest(a.ctx, ev.id, { name: "ضيف أول", phone: "+966512340001", group_id: group.id });
    const g2 = createGuest(a.ctx, ev.id, { name: "ضيف ثانٍ", phone: "+966512340002" });
    const i1 = issueInvitation(a.ctx, ev.id, { guest_id: g1.id });
    issueInvitation(a.ctx, ev.id, { guest_id: g2.id });
    const page = getGuestPage(a.ctx.db, i1.token);
    expect(page.guest_name).toBe("ضيف أول");
    expect(page.vars["guest.name"]).toBe("ضيف أول");
    expect(page.vars["guest.allowed_companions"]).toBe(5);
    expect(page.vars["invitation.category"]).toBe("عائلات");
    expect(page.scenes).toBeNull(); // يستخدم المحرك المشاهد الافتراضية عند غياب مشاهد مخصصة
    expect(JSON.stringify(page)).not.toContain("ضيف ثانٍ");
  });
});
