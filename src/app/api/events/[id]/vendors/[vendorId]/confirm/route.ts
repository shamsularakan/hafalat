import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { confirmVendorSelection } from "@/server/services/operations";

type P = { params: Promise<{ id: string; vendorId: string }> };

export const POST = route(async (req: Request, { params }: P) => {
  const { id, vendorId } = await params;
  return ok(await confirmVendorSelection(await buildCtx(clientIp(req)), id, vendorId, await readJson(req)));
});
