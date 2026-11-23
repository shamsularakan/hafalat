import { route, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { exportReport } from "@/server/services/reports";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const ctx = await buildCtx(clientIp(req));
  const kind = (new URL(req.url).searchParams.get("kind") ?? "summary") as any;
  const csv = (await exportReport(ctx, id, kind));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${id.slice(0, 8)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
