import { route, ok, clientIp } from "@/lib/api";
import fs from "node:fs";
import { buildCtx } from "@/server/context";
import { getAssetForOwner, deleteMedia } from "@/server/services/media";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const { asset, full } = (await getAssetForOwner(ctx, id));
  const data = fs.readFileSync(full);
  return new Response(data, {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(asset.bytes),
      "Cache-Control": "private, max-age=86400",
      "Content-Disposition": `inline; filename="${encodeURIComponent(asset.original_name ?? id)}"`,
    },
  });
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  return ok((await deleteMedia(ctx, id)));
});
