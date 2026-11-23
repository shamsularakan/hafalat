import { route, ok, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { uploadMedia } from "@/server/services/media";
import { err } from "@/lib/errors";

/** رفع وسائط multipart: file, kind, event_id, rights_attested, rights_note */
export const POST = route(async (req: Request) => {
  const ctx = await buildCtx(clientIp(req));
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) err("VALIDATION", "ملف مطلوب");
  const kind = String(form.get("kind") ?? "image") as "audio" | "image" | "logo";
  if (!["audio", "image", "logo"].includes(kind)) err("VALIDATION", "نوع وسائط غير صالح");
  const bytes = new Uint8Array(await file.arrayBuffer());
  return ok((await uploadMedia(ctx, {
    bytes,
    mime: file.type || "application/octet-stream",
    originalName: file.name || "file",
    kind,
    eventId: form.get("event_id") ? String(form.get("event_id")) : null,
    rightsAttested: form.get("rights_attested") === "true" || form.get("rights_attested") === "1",
    rightsNote: form.get("rights_note") ? String(form.get("rights_note")) : undefined,
  })), 201);
});
