import { route, ok, readJson, clientIp } from "@/lib/api";
import { buildCtx } from "@/server/context";
import { vendorDirectory, linkVendorProfile } from "@/server/services/vendor-portal";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const u = new URL(req.url).searchParams;
  return ok(await vendorDirectory(await buildCtx(clientIp(req)), id, {
    q: u.get("q") ?? undefined, category: u.get("category") ?? undefined, city: u.get("city") ?? undefined,
  }));
});

/** { profile_id } — إضافة مورد من الدليل إلى المناسبة */
export const POST = route(async (req: Request, { params }: P) => {
  const { id } = await params;
  const { profile_id } = await readJson(req);
  return ok(await linkVendorProfile(await buildCtx(clientIp(req)), id, String(profile_id ?? "")), 201);
});
