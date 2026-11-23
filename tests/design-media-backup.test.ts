/** التصميم والإصدارات والوسائط (القسم 05) + AC-15 النسخ الاحتياطي */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setup, publishedEvent, addGuests, expectAppError } from "./helpers";
import { saveDraft, publishDesign, getDesign, BUILTIN_TEMPLATES } from "@/server/services/designs";
import { uploadMedia, getAudioForGuestToken, deleteMedia } from "@/server/services/media";
import { issueInvitation } from "@/server/services/invitations";
import { createDb, createTestDb } from "@/lib/db";
import { registerUser } from "@/lib/auth";

describe("التصميم", () => {
  it("مسودة ثم نشر بإصدارات، والنشر لا يمس البيانات التشغيلية", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    const schema = { ...BUILTIN_TEMPLATES[0].schema, cover: { ...BUILTIN_TEMPLATES[0].schema.cover, title: "دعوة آل تجريبي" } };
    const draft = saveDraft(a.ctx, ev.id, { template_id: "tpl-royal", schema })!;
    expect(draft.state).toBe("draft");
    const draft2 = saveDraft(a.ctx, ev.id, { template_id: "tpl-royal", schema: { ...schema, cover: { ...schema.cover, title: "دعوة محدثة" } } })!;
    expect(draft2.version).toBe(2);
    const pub = publishDesign(a.ctx, ev.id)!;
    expect(pub.state).toBe("published");
    // الدعوة كما هي
    const inv = db.get<any>("SELECT * FROM invitations WHERE id = ?", issued.invitation_id);
    expect(inv.status).toBe("issued");
    expect(inv.persons_reserved).toBe(1);
    const designs = getDesign(a.ctx, ev.id);
    expect(designs.published).toBeTruthy();
  });

  it("يرفض تصميمًا بلا عنوان أو بألوان غير صالحة", () => {
    const { a } = setup();
    const ev = publishedEvent(a.ctx);
    const bad = { ...BUILTIN_TEMPLATES[0].schema, cover: { ...BUILTIN_TEMPLATES[0].schema.cover, title: "" } };
    expectAppError(() => saveDraft(a.ctx, ev.id, { schema: bad }), "VALIDATION");
    const badColor = { ...BUILTIN_TEMPLATES[0].schema, palette: { ...BUILTIN_TEMPLATES[0].schema.palette, bg: "red" } };
    expectAppError(() => saveDraft(a.ctx, ev.id, { schema: badColor }), "VALIDATION");
  });
});

describe("الوسائط وحقوق الصوت", () => {
  it("الصوت يتطلب تأكيد حق الاستخدام", () => {
    const { a } = setup();
    const ev = publishedEvent(a.ctx);
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]);
    expectAppError(() => uploadMedia(a.ctx, { bytes, mime: "audio/mpeg", originalName: "nasheed.mp3", kind: "audio", eventId: ev.id, rightsAttested: false }), "VALIDATION");
    const asset = uploadMedia(a.ctx, { bytes, mime: "audio/mpeg", originalName: "nasheed.mp3", kind: "audio", eventId: ev.id, rightsAttested: true, rightsNote: "ملكية العميل" })!;
    expect(asset.rights_attested).toBe(1);
  });

  it("يرفض الأنواع غير المصرح بها وSVG", () => {
    const { a } = setup();
    const bytes = new Uint8Array([1, 2, 3]);
    expectAppError(() => uploadMedia(a.ctx, { bytes, mime: "image/svg+xml", originalName: "x.svg", kind: "image", rightsAttested: false }), "VALIDATION");
    expectAppError(() => uploadMedia(a.ctx, { bytes, mime: "application/x-msdownload", originalName: "x.exe", kind: "image", rightsAttested: false }), "VALIDATION");
  });

  it("صوت الدعوة يُخدم عبر رمز صالح فقط", () => {
    const { db, a } = setup();
    const ev = publishedEvent(a.ctx);
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 9, 9]);
    const asset = uploadMedia(a.ctx, { bytes, mime: "audio/mpeg", originalName: "n.mp3", kind: "audio", eventId: ev.id, rightsAttested: true })!;
    const schema = BUILTIN_TEMPLATES[0].schema;
    saveDraft(a.ctx, ev.id, { schema, audio_asset_id: asset.id });
    publishDesign(a.ctx, ev.id);
    const g = addGuests(a.ctx, ev.id, 1)[0];
    const issued = issueInvitation(a.ctx, ev.id, { guest_id: g.id });
    const { asset: served } = getAudioForGuestToken(db, issued.token);
    expect(served.id).toBe(asset.id);
    expectAppError(() => getAudioForGuestToken(db, "z".repeat(43)), "INVALID_TOKEN");
    deleteMedia(a.ctx, asset.id);
    expectAppError(() => getAudioForGuestToken(db, issued.token), "NOT_FOUND");
  });
});

describe("AC-15 استعادة نسخة احتياطية", () => {
  it("نسخ قاعدة البيانات واستعادتها يعيد الحالة", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dawat-backup-"));
    const livePath = path.join(dir, "live.db");
    const db = createDb(livePath);
    const { user, orgId } = registerUser(db, { name: "مالك", email: "backup@test.local", password: "Password123!", orgName: "منظمة النسخ" });
    db.run(
      "INSERT INTO events (id, organization_id, owner_id, title, type, capacity) VALUES ('ev-backup',?,?, 'مناسبة للاستعادة','wedding',50)",
      orgId, user.id
    );
    db.close(); // يضمن checkpoint لملف WAL
    const restorePath = path.join(dir, "restored.db");
    fs.copyFileSync(livePath, restorePath);
    const restored = createDb(restorePath);
    expect(restored.get<any>("SELECT name FROM users WHERE email = 'backup@test.local'").name).toBe("مالك");
    expect(restored.get<any>("SELECT title FROM events WHERE id = 'ev-backup'").title).toBe("مناسبة للاستعادة");
    expect(restored.get<any>("SELECT COUNT(*) n FROM plans").n).toBe(4);
    restored.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
