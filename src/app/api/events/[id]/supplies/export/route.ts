import { route, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { exportSuppliesCsv } from "@/server/services/supplies";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const csv = await exportSuppliesCsv(await buildCtx(clientIp(req)), id);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="supplies-${id.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
