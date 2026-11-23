/**
 * طبقة الوصول للبيانات — DAWAT
 * SQLite (node:sqlite) للتطوير والاختبارات؛ SQL قياسي قابل للترحيل إلى PostgreSQL
 * (Supabase/Neon) دون ربط منطق الخدمات بمنصة واحدة. كل الخدمات تستقبل Ctx يحمل db.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { seedPlans, seedTemplates } from "./seeds";
import { seedPlanningTemplates } from "./planning-seeds";

export type SQLValue = string | number | null | Uint8Array;
export type Row = Record<string, any>;

export class DB {
  raw: DatabaseSync;
  private depth = 0;

  constructor(filePath: string) {
    if (filePath !== ":memory:") {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    this.raw = new DatabaseSync(filePath);
    this.raw.exec("PRAGMA journal_mode = WAL;");
    this.raw.exec("PRAGMA foreign_keys = ON;");
    this.raw.exec("PRAGMA busy_timeout = 5000;");
  }

  exec(sql: string) {
    this.raw.exec(sql);
  }

  run(sql: string, ...params: SQLValue[]) {
    return this.raw.prepare(sql).run(...params);
  }

  get<T = Row>(sql: string, ...params: SQLValue[]): T | undefined {
    return this.raw.prepare(sql).get(...params) as T | undefined;
  }

  all<T = Row>(sql: string, ...params: SQLValue[]): T[] {
    return this.raw.prepare(sql).all(...params) as T[];
  }

  /** معاملة ذرّية: BEGIN IMMEDIATE لمنع تجاوز الحصص عند التزامن (AC-02) */
  tx<T>(fn: () => T): T {
    if (this.depth > 0) {
      // معاملة متداخلة → SAVEPOINT
      const name = `sp_${this.depth}`;
      this.raw.exec(`SAVEPOINT ${name}`);
      this.depth++;
      try {
        const out = fn();
        this.raw.exec(`RELEASE ${name}`);
        return out;
      } catch (e) {
        this.raw.exec(`ROLLBACK TO ${name}`);
        this.raw.exec(`RELEASE ${name}`);
        throw e;
      } finally {
        this.depth--;
      }
    }
    this.raw.exec("BEGIN IMMEDIATE");
    this.depth = 1;
    try {
      const out = fn();
      this.raw.exec("COMMIT");
      return out;
    } catch (e) {
      try {
        this.raw.exec("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw e;
    } finally {
      this.depth = 0;
    }
  }

  close() {
    this.raw.close();
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function migrate(db: DB, migrationsDir?: string) {
  const dir =
    migrationsDir ??
    process.env.DAWAT_MIGRATIONS_DIR ??
    path.join(process.cwd(), "db", "migrations");
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`
  );
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const done = db.get(
      "SELECT version FROM schema_migrations WHERE version = ?",
      version
    );
    if (done) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    db.tx(() => {
      db.exec(sql);
      db.run(
        "INSERT INTO schema_migrations (version) VALUES (?)",
        version
      );
    });
  }
}

export function createDb(filePath: string): DB {
  const db = new DB(filePath);
  migrate(db);
  // بذر الباقات والقوالب العامة (idempotent)
  seedPlans(db);
  seedTemplates(db);
  seedPlanningTemplates(db);
  return db;
}

let singleton: DB | null = null;

/** قاعدة بيانات التطبيق (singleton لكل عملية) */
export function getDb(): DB {
  if (!singleton) {
    const p =
      process.env.DAWAT_DB_PATH ?? path.join(process.cwd(), "data", "dawat.db");
    singleton = createDb(p === ":memory:" ? ":memory:" : path.resolve(p));
  }
  return singleton;
}

/** للاختبارات: قاعدة معزولة في الذاكرة */
export function createTestDb(): DB {
  return createDb(":memory:");
}
