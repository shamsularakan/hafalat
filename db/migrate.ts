/** تشغيل الترحيلات + بذر الباقات والقوالب العامة: npm run migrate */
import path from "node:path";
import { createDb } from "../src/lib/db";

const dbPath = path.resolve(process.env.DAWAT_DB_PATH ?? "./data/dawat.db");
const db = createDb(dbPath);
const versions = db.all<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version");
console.log(`✔ قاعدة البيانات: ${dbPath}`);
console.log(`✔ الترحيلات المطبقة: ${versions.map((v) => v.version).join(", ")}`);
console.log(`✔ الباقات: ${db.get<{ n: number }>("SELECT COUNT(*) n FROM plans")!.n} · القوالب العامة: ${db.get<{ n: number }>("SELECT COUNT(*) n FROM templates")!.n}`);
db.close();
