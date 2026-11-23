/** نسخ احتياطي حي آمن: npm run backup — يستخدم VACUUM INTO (متسق مع WAL) */
import path from "node:path";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const dbPath = path.resolve(process.env.DAWAT_DB_PATH ?? "./data/dawat.db");
if (!fs.existsSync(dbPath)) {
  console.error("✘ قاعدة البيانات غير موجودة:", dbPath);
  process.exit(1);
}
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backupDir = path.resolve("./backups");
fs.mkdirSync(backupDir, { recursive: true });
const target = path.join(backupDir, `dawat-${stamp}.db`);

const db = new DatabaseSync(dbPath, { readOnly: true });
db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
db.close();

// تحقق سريع من سلامة النسخة (AC-15)
const check = new DatabaseSync(target, { readOnly: true });
const integrity = check.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
const users = (check.prepare("SELECT COUNT(*) n FROM users").get() as { n: number }).n;
check.close();

console.log(`✔ نسخة احتياطية: ${target}`);
console.log(`✔ سلامة النسخة: ${integrity.integrity_check} · مستخدمون: ${users}`);
console.log("ℹ للاستعادة: أوقف الخادم ثم انسخ الملف إلى مسار DAWAT_DB_PATH.");
