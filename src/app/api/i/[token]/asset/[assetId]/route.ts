import { route } from "@/lib/api";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { err } from "@/lib/errors";
import { findInvitationByToken } from "@/server/services/rsvp";
import { uploadDir } from "@/server/services/media";

type P = { params: Promise<{ token: string; assetId: string }> };

/** وسائط الدعوة (شعار/خلفية) — مربوطة بدعوة صالحة وتصميمها فقط */
export const GET = route(async (_req: Request, { params }: P) => {
  const { token, assetId } = await params;
  const db = (await getDb());
  const inv = (await findInvitationByToken(db, token));
  const design = (await db.get<any>(
    "SELECT scenes_json FROM invitation_designs WHERE event_id = ? AND state = 'published'", inv.event_id
  )) ?? (await db.get<any>("SELECT scenes_json FROM invitation_designs WHERE event_id = ? AND state = 'draft'", inv.event_id));
  if (!design) err("NOT_FOUND");
  const schema = JSON.parse(design.scenes_json);
  if (schema.logo_asset_id !== assetId && schema.background_asset_id !== assetId)
    err("NOT_FOUND", "الملف غير مرتبط بهذه الدعوة");
  const asset = (await db.get<any>(
    "SELECT * FROM media_assets WHERE id = ? AND status = 'active' AND kind IN ('image','logo')", assetId
  ));
  if (!asset) err("NOT_FOUND");
  const full = path.join(uploadDir(), asset.storage_key);
  if (!fs.existsSync(full)) err("NOT_FOUND");
  return new Response(fs.readFileSync(full), {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(asset.bytes),
      "Cache-Control": "private, max-age=86400",
    },
  });
});
