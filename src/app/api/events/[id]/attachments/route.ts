import { route, ok, clientIp } from "@/lib/api";
import { err } from "@/lib/errors";
import { buildCtx } from "@/server/context";
import { listAttachments, uploadAttachment } from "@/server/services/resources";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  return ok((await listAttachments(await buildCtx(clientIp(req)), id)));
});

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) err("VALIDATION", "ملف مطلوب");
  return ok((await uploadAttachment(ctx, id,
    { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type || "application/octet-stream", name: file.name },
    { kind: String(form.get("kind") ?? "other"), title: String(form.get("title") ?? file.name), vendorId: form.get("vendor_id") ? String(form.get("vendor_id")) : undefined }
  )), 201);
});
