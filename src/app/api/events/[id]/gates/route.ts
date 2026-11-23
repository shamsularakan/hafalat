import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { requireEventAccess } from "@/lib/permissions";
import { newId } from "@/lib/db";
import { err } from "@/lib/errors";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  (await requireEventAccess(ctx, id, ["owner", "manager", "supervisor", "receptionist"]));
  return ok((await ctx.db.all("SELECT * FROM gates WHERE event_id = ? ORDER BY created_at", id)));
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  (await requireEventAccess(ctx, id, ["owner", "manager"]));
  const { name } = await readJson(req);
  if (!name?.trim()) err("VALIDATION", "اسم البوابة مطلوب");
  const gateId = newId();
  (await ctx.db.run(
    "INSERT INTO gates (id, event_id, organization_id, name) VALUES (?,?,?,?)",
    gateId, id, ctx.actor.orgId, name.trim()
  ));
  return ok((await ctx.db.get("SELECT * FROM gates WHERE id = ?", gateId)), 201);
});
