/** التصميم والإصدارات والوسائط (القسم 05) + AC-15 النسخ الاحتياطي */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { setup, publishedEvent, addGuests, expectAppErrorAsync } from "./helpers";
import { saveDraft, publishDesign, getDesign, BUILTIN_TEMPLATES } from "@/server/services/designs";
import { uploadMedia, getAudioForGuestToken, deleteMedia } from "@/server/services/media";
import { issueInvitation } from "@/server/services/invitations";
import { createDb, createTestDb } from "@/lib/db";
import { registerUser } from "@/lib/auth";

describe("التصميم", async () => {
  it("مسودة ثم نشر بإصدارات، والنشر لا يمس البيانات التشغيلية", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    const issued = (await issueInvitation(a.ctx, ev.id, { guest_id: g.id }));
    const schema = { ...BUILTIN_TEMPLATES[0].schema, cover: { ...BUILTIN_TEMPLATES[0].schema.cover, title: "دعوة آل تجريبي" } };
    const draft = (await saveDraft(a.ctx, ev.id, { template_id: "tpl-royal", schema }))!;
    expect(draft.state).toBe("draft");
    const draft2 = (await saveDraft(a.ctx, ev.id, { template_id: "tpl-royal", schema: { ...schema, cover: { ...schema.cover, title: "دعوة محدثة" } } }))!;
    expect(draft2.version).toBe(2);
    const pub = (await publishDesign(a.ctx, ev.id))!;
    expect(pub.state).toBe("published");
    // الدعوة كما هي
    const inv = (await db.get<any>("SELECT * FROM invitations WHERE id = ?", issued.invitation_id));
    expect(inv.status).toBe("issued");
    expect(inv.persons_reserved).toBe(1);
    const designs = (await getDesign(a.ctx, ev.id));
    expect(designs.published).toBeTruthy();
  });

  it("يرفض تصميمًا بلا عنوان أو بألوان غير صالحة", async () => {
    const { a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const bad = { ...BUILTIN_TEMPLATES[0].schema, cover: { ...BUILTIN_TEMPLATES[0].schema.cover, title: "" } };
    await expectAppErrorAsync(async () => (await saveDraft(a.ctx, ev.id, { schema: bad })), "VALIDATION");
    const badColor = { ...BUILTIN_TEMPLATES[0].schema, palette: { ...BUILTIN_TEMPLATES[0].schema.palette, bg: "red" } };
    await expectAppErrorAsync(async () => (await saveDraft(a.ctx, ev.id, { schema: badColor })), "VALIDATION");
  });
});

describe("الوسائط وحقوق الصوت", async () => {
  it("الصوت يتطلب تأكيد حق الاستخدام", async () => {
    const { a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]);
    await expectAppErrorAsync(async () => (await uploadMedia(a.ctx, { bytes, mime: "audio/mpeg", originalName: "nasheed.mp3", kind: "audio", eventId: ev.id, rightsAttested: false })), "VALIDATION");
    const asset = (await uploadMedia(a.ctx, { bytes, mime: "audio/mpeg", originalName: "nasheed.mp3", kind: "audio", eventId: ev.id, rightsAttested: true, rightsNote: "ملكية العميل" }))!;
    expect(asset.rights_attested).toBe(1);
  });

  it("يرفض الأنواع غير المصرح بها وSVG", async () => {
    const { a } = (await setup());
    const bytes = new Uint8Array([1, 2, 3]);
    await expectAppErrorAsync(async () => (await uploadMedia(a.ctx, { bytes, mime: "image/svg+xml", originalName: "x.svg", kind: "image", rightsAttested: false })), "VALIDATION");
    await expectAppErrorAsync(async () => (await uploadMedia(a.ctx, { bytes, mime: "application/x-msdownload", originalName: "x.exe", kind: "image", rightsAttested: false })), "VALIDATION");
  });

  it("صوت الدعوة يُخدم عبر رمز صالح فقط", async () => {
    const { db, a } = (await setup());
    const ev = (await publishedEvent(a.ctx));
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 9, 9]);
    const asset = (await uploadMedia(a.ctx, { bytes, mime: "audio/mpeg", originalName: "n.mp3", kind: "audio", eventId: ev.id, rightsAttested: true }))!;
    const schema = BUILTIN_TEMPLATES[0].schema;
    (await saveDraft(a.ctx, ev.id, { schema, audio_asset_id: asset.id }));
    (await publishDesign(a.ctx, ev.id));
    const g = (await addGuests(a.ctx, ev.id, 1))[0];
    const issued = (await issueInvitation(a.ctx, ev.id, { guest_id: g.id }));
    const { asset: served } = (await getAudioForGuestToken(db, issued.token));
    expect(served.id).toBe(asset.id);
    await expectAppErrorAsync(async () => (await getAudioForGuestToken(db, "z".repeat(43))), "INVALID_TOKEN");
    (await deleteMedia(a.ctx, asset.id));
    await expectAppErrorAsync(async () => (await getAudioForGuestToken(db, issued.token)), "NOT_FOUND");
  });
});

describe("AC-15 استعادة نسخة احتياطية", async () => {
  it("نسخ قاعدة البيانات واستعادتها يعيد الحالة", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dawat-backup-"));
    const livePath = path.join(dir, "live.db");
    const db = (await createDb(livePath));
    const { user, orgId } = (await registerUser(db, { name: "مالك", email: "backup@test.local", password: "Password123!", orgName: "منظمة النسخ" }));
    (await db.run(
      "INSERT INTO events (id, organization_id, owner_id, title, type, capacity) VALUES ('ev-backup',?,?, 'مناسبة للاستعادة','wedding',50)",
      orgId, user.id
    ));
    db.close(); // يضمن checkpoint لملف WAL
    const restorePath = path.join(dir, "restored.db");
    fs.copyFileSync(livePath, restorePath);
    const restored = (await createDb(restorePath));
    expect((await restored.get<any>("SELECT name FROM users WHERE email = 'backup@test.local'")).name).toBe("مالك");
    expect((await restored.get<any>("SELECT title FROM events WHERE id = 'ev-backup'")).title).toBe("مناسبة للاستعادة");
    expect((await restored.get<any>("SELECT COUNT(*) n FROM plans")).n).toBe(4);
    restored.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
