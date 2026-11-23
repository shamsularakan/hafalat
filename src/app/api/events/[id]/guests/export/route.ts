import { route, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { exportGuestsCsv } from "@/server/services/guests";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const csv = exportGuestsCsv(ctx, id);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="guests-${id.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
