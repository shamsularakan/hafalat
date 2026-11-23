import { route, ok, readJson, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { buildCtx } from "@/server/context";
import { saveChecklistItem, deleteChecklistItem } from "@/server/services/planning";

type P = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const c = (await (await getDb()).get<{ event_id: string }>("SELECT event_id FROM checklists WHERE id = ?", id));
  if (!c) err("NOT_FOUND");
  return ok((await saveChecklistItem(ctx, c.event_id, id, await readJson(req))), 201);
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const it = (await (await getDb()).get<{ event_id: string }>(
    "SELECT c.event_id FROM checklist_items ci JOIN checklists c ON c.id = ci.checklist_id WHERE ci.id = ?", id
  ));
  if (!it) err("NOT_FOUND");
  return ok((await deleteChecklistItem(ctx, it.event_id, id)));
});
