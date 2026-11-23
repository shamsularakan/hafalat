import { route, ok, clientIp } from "@/lib/api";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { buildCtx } from "@/server/context";
import { getAttachment, deleteAttachment } from "@/server/services/resources";

type P = { params: Promise<{ id: string; attachmentId: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id, attachmentId } = await params;
  const { asset, full } = (await getAttachment(await buildCtx(clientIp(req)), id, attachmentId));
  const fs = await import("node:fs");
  return new Response(fs.readFileSync(full), {
    headers: { "Content-Type": asset.mime, "Cache-Control": "private, max-age=3600" },
  });
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id, attachmentId } = await params;
  return ok((await deleteAttachment(await buildCtx(clientIp(req)), id, attachmentId)));
});
