import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { importGuests } from "@/server/services/guests";

type P = { params: Promise<{ id: string }> };

export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const body = await readJson(req, 5 * 1024 * 1024);
  if (!body.csv) {
    const { AppError } = await import("@/lib/errors");
    throw new AppError("VALIDATION", "محتوى CSV مطلوب");
  }
  return ok((await importGuests(ctx, id, {
    csv: body.csv, mapping: body.mapping, dryRun: body.dryRun !== false, filename: body.filename,
  })));
});
