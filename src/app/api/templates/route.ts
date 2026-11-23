import { route, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { buildCtx } from "@/server/context";

/** مكتبة القوالب مع بحث/تصفية/مفضلة */
export const GET = route(async (req: Request) => {
  const ctx = await buildCtx();
  const p = new URL(req.url).searchParams;
  const q = p.get("q")?.trim() ?? "";
  const category = p.get("category") ?? "";
  const favorite = p.get("favorite") === "1";
  const where = ["(t.visibility = 'public' OR t.organization_id = ?)"];
  const args: any[] = [ctx.actor.orgId];
  if (q) { where.push("(t.name_ar LIKE ? OR t.style LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
  if (category) { where.push("t.category = ?"); args.push(category); }
  if (favorite) {
    where.push("EXISTS (SELECT 1 FROM template_favorites f WHERE f.template_id = t.id AND f.user_id = ?)");
    args.push(ctx.actor.user.id);
  }
  return ok((await (await getDb()).all(
    `SELECT t.*, EXISTS(SELECT 1 FROM template_favorites f WHERE f.template_id=t.id AND f.user_id=?) favorite
     FROM templates t WHERE ${where.join(" AND ")} ORDER BY t.is_favorite DESC, t.category, t.name_ar`,
    ctx.actor.user.id, ...args
  )));
});
