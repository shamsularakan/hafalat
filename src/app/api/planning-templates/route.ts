import { route, ok } from "@/lib/api";
import { getDb } from "@/lib/db";

export const GET = route(async () => {
  return ok((await (await getDb()).all("SELECT id, event_type, name_ar, version FROM planning_templates ORDER BY name_ar")));
});
