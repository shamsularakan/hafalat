import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { requireOrgRole } from "@/lib/permissions";
import { newId } from "@/lib/db";
import { err } from "@/lib/errors";

/** قوالب نصوص الإرسال بمعاملات {اسم_الضيف} و{رابط_الدعوة} و{اسم_المناسبة} */
export const GET = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  return ok((await ctx.db.all(
    "SELECT * FROM message_templates WHERE organization_id = ? ORDER BY created_at", ctx.actor.orgId
  )));
});

export const POST = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  requireOrgRole(ctx, ["owner", "admin", "member"]);
  const { name, body } = await readJson(req);
  if (!name?.trim() || !body?.trim()) err("VALIDATION", "الاسم والنص مطلوبان");
  if (body.length > 2000) err("VALIDATION", "النص طويل جدًا");
  const id = newId();
  (await ctx.db.run(
    "INSERT INTO message_templates (id, organization_id, name, channel, body) VALUES (?,?,?,'whatsapp_manual',?)",
    id, ctx.actor.orgId, name.trim(), body.trim()
  ));
  return ok((await ctx.db.get("SELECT * FROM message_templates WHERE id = ?", id)), 201);
});
