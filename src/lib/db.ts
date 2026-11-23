/**
 * طبقة الوصول للبيانات — ليلتنا
 * وضعان: SQLite (node:sqlite) للتطوير/الاختبارات، Neon Postgres للإنتاج (DATABASE_URL).
 * كل الطرق غير متزامنة لدعم السحابة؛ الواجهة واحدة.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { seedPlans, seedTemplates } from "./seeds";
import { seedPlanningTemplates } from "./planning-seeds";

export type SQLValue = string | number | null | Uint8Array;
export type Row = Record<string, any>;

export function nowIso(): string {
  return new Date().toISOString();
}
export function newId(): string {
  return crypto.randomUUID();
}

interface QueryResult {
  rows: Row[];
  changes: number;
  lastInsertRowid: string | number | null;
}

export class DB {
  private sqlite: DatabaseSync | null = null;
  private sql: NeonQueryFunction<false, false> | null = null;
  private depth = 0;
  readonly mode: "sqlite" | "neon";

  constructor(target: string) {
    if (target.startsWith("postgres")) {
      this.mode = "neon";
      this.sql = neon(target);
    } else {
      this.mode = "sqlite";
      if (target !== ":memory:") fs.mkdirSync(path.dirname(target), { recursive: true });
      this.sqlite = new DatabaseSync(target);
      this.sqlite.exec("PRAGMA journal_mode = WAL;");
      this.sqlite.exec("PRAGMA foreign_keys = ON;");
      this.sqlite.exec("PRAGMA busy_timeout = 5000;");
    }
  }

  private q(sql: string) {
    return this.mode === "neon" ? sql.replace(/\browid\b/gi, "ctid") : sql;
  }

  async exec(sqlText: string): Promise<void> {
    if (this.sqlite) { this.sqlite.exec(sqlText); return; }
    const clean = this.q(sqlText).replace(/--[^\n]*/g, "");
    for (const statement of clean.split(";")) {
      const s = statement.trim();
      if (s) await this.sql!.query(s, []);
    }
  }

  async run(sqlText: string, ...params: SQLValue[]): Promise<QueryResult> {
    if (this.sqlite) {
      const r = this.sqlite.prepare(sqlText).run(...params);
      return { rows: [], changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid as any };
    }
    const rows = await this.sql!.query(this.q(sqlText), params as any[]);
    return { rows: rows as Row[], changes: (rows as any).rowCount ?? rows.length, lastInsertRowid: null };
  }

  async get<T = Row>(sqlText: string, ...params: SQLValue[]): Promise<T | undefined> {
    if (this.sqlite) return this.sqlite.prepare(sqlText).get(...params) as T | undefined;
    const rows = await this.sql!.query(this.q(sqlText), params as any[]);
    return (rows[0] as T) ?? undefined;
  }

  async all<T = Row>(sqlText: string, ...params: SQLValue[]): Promise<T[]> {
    if (this.sqlite) return this.sqlite.prepare(sqlText).all(...params) as T[];
    return (await this.sql!.query(this.q(sqlText), params as any[])) as T[];
  }

  /** معاملة ذرّية: BEGIN IMMEDIATE (SQLite) / BEGIN (Postgres) */
  async tx<T>(fn: () => Promise<T> | T): Promise<T> {
    if (this.depth > 0) return fn();
    this.depth = 1;
    await this.run(this.mode === "sqlite" ? "BEGIN IMMEDIATE" : "BEGIN");
    try {
      const out = await fn();
      await this.run("COMMIT");
      return out;
    } catch (e) {
      try { await this.run("ROLLBACK"); } catch { /* ignore */ }
      throw e;
    } finally {
      this.depth = 0;
    }
  }

  close() {
    this.sqlite?.close();
  }
}

const PG_NOW = `to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

export async function migrate(db: DB, migrationsDir?: string) {
  const dir =
    migrationsDir ??
    process.env.DAWAT_MIGRATIONS_DIR ??
    path.join(process.cwd(), "db", "migrations");
  const defaultNow = db.mode === "neon" ? PG_NOW : `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
  await db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT ${defaultNow})`
  );
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    const done = await db.get("SELECT version FROM schema_migrations WHERE version = ?", version);
    if (done) continue;
    const sqlText = fs.readFileSync(path.join(dir, file), "utf8");
    await db.tx(async () => {
      // 003 يحدث بيانات بصرية قديمة بدوال JSON خاصة بـ SQLite؛ قوالبنا الجديدة مُبذَرة بالفعل بالهوية الجديدة
      if (!(db.mode === "neon" && file.startsWith("003_"))) {
        await db.exec(db.mode === "neon" ? adaptSql(sqlText) : sqlText);
      }
      await db.run("INSERT INTO schema_migrations (version) VALUES (?)", version);
    });
  }
}

/** تكييف SQL من SQLite إلى Postgres (يغطي أنماط ملفات الهجرة لدينا). */
export function adaptSql(sql: string): string {
  let out = sql
    .replace(/--[^\n]*/g, "")
    .replace(/strftime\('%Y-%m-%dT%H:%M:%fZ'\s*,\s*'now'\)/g, PG_NOW)
    .replace(/datetime\('\s*now\s*'\)/g, PG_NOW)
    .replace(/\bAUTOINCREMENT\b/g, "")
    .replace(/\bINSERT\s+OR\s+IGNORE\b/gi, "INSERT")
    .replace(/\bGLOB\b/g, "LIKE");
  // INSERT OR IGNORE -> ON CONFLICT DO NOTHING (بعد تحويل INSERT OR IGNORE إلى INSERT)
  out = out.replace(/(INSERT\s+INTO\s+[\w.]+[\s\S]*?;\s*)/g, (m) => {
    if (/ON\s+CONFLICT/i.test(m)) return m;
    return m.replace(/;\s*$/, " ON CONFLICT DO NOTHING;\n");
  });
  return out;
}

export async function createDb(filePath: string): Promise<DB> {
  const db = new DB(filePath);
  await migrate(db);
  await seedPlans(db);
  await seedTemplates(db);
  await seedPlanningTemplates(db);
  return db;
}

let singleton: DB | null = null;

export async function getDb(): Promise<DB> {
  if (!singleton) {
    const target = process.env.DATABASE_URL
      ? process.env.DATABASE_URL
      : path.resolve(process.env.DAWAT_DB_PATH ?? path.join(process.cwd(), "data", "dawat.db"));
    singleton = await createDb(target);
  }
  return singleton;
}

export async function createTestDb(): Promise<DB> {
  return (await createDb(":memory:"));
}
