import { getDb } from "../src/lib/db";

async function main() {
  console.log("step: getDb");
  const db = await getDb();
  console.log("MODE:", db.mode);
  console.log("step: plans count");
  console.log("PLANS:", (await db.get<{ n: number }>("SELECT COUNT(*) n FROM plans"))!.n);
  console.log("step: migrations count");
  console.log("MIGRATIONS:", (await db.all<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version")).map((x) => x.version).join(","));
  console.log("step: templates count");
  console.log("TEMPLATES:", (await db.get<{ n: number }>("SELECT COUNT(*) n FROM templates"))!.n);
  db.close();
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
