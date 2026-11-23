/**
 * طبقة الوصول للبيانات — ليلتنا
 * SQLite (node:sqlite) للتطوير/الاختبارات، Neon Postgres (pg) للإنتاج عبر DATABASE_URL.
 * كل الطرق غير متزامنة؛ الواجهة واحدة. استعلامات Postgres تُكيَّف تلقائيًا (? ← $n).
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { neonConfig, Pool, type PoolClient } from "@neondatabase/serverless";
import WebSocket from "ws";

// ويب سوكيت على المنفذ 443 — يعمل خلف جدران الحماية ويدعم المعاملات
neonConfig.webSocketConstructor = WebSocket as any;
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

interface DBResult {
  rows: Row[];
  changes: number;
  lastInsertRowid: string | number | null;
}

export class DB {
  private sqlite: DatabaseSync | null = null;
  private pool: Pool | null = null;
  private txClient = new AsyncLocalStorage<PoolClient>();
  readonly mode: "sqlite" | "neon";

  constructor(target: string) {
    if (target.startsWith("postgres")) {
      this.mode = "neon";
      this.pool = new Pool({ connectionString: target, max: 5, idleTimeoutMillis: 30000 });
    } else {
      this.mode = "sqlite";
      if (target !== ":memory:") fs.mkdirSync(path.dirname(target), { recursive: true });
      this.sqlite = new DatabaseSync(target);
      this.sqlite.exec("PRAGMA journal_mode = WAL;");
      this.sqlite.exec("PRAGMA foreign_keys = ON;");
      this.sqlite.exec("PRAGMA busy_timeout = 5000;");
    }
  }

  /** تكييف الاستعلام لـ Postgres: rowid ← ctid، و? ← $n مع تجاهل ما داخل النصوص. */
  private q(sql: string, params?: SQLValue[]) {
    if (this.mode !== "neon") return sql;
    let out = sql
      .replace(/\browid\b/gi, "ctid")
      // Postgres لا يستطيع استنتاج نوع المتغير في «? IS NOT NULL»
      .replace(/(\?)\s+(IS\s+(?:NOT\s+)?NULL)/gi, "$1::text $2");
    if (params && params.length) {
      let n = 0, res = "", inSingle = false, inDouble = false;
      for (let i = 0; i < out.length; i++) {
        const ch = out[i];
        if (ch === "'" && !inDouble) { inSingle = !inSingle; res += ch; continue; }
        if (ch === '"' && !inSingle) { inDouble = !inDouble; res += ch; continue; }
        if (ch === "?" && !inSingle && !inDouble) { res += "$" + (++n); continue; }
        res += ch;
      }
      out = res;
    }
    return out;
  }

  private txQueue: Promise<any> = Promise.resolve();

  private async pgQuery(sqlText: string, params: SQLValue[]): Promise<DBResult> {
    const pinned = this.txClient.getStore();
    const sql = this.q(sqlText, params);
    let r;
    if (pinned) {
      // pg لا يسمح باستعلامات متزامنة على نفس العميل داخل معاملة → liste sıraya al
      const job = this.txQueue.then(() => pinned.query(sql, params as any[]));
      this.txQueue = job.catch(() => {});
      r = await job;
    } else {
      r = await this.pool!.query(sql, params as any[]);
    }
    return { rows: r.rows as Row[], changes: r.rowCount ?? 0, lastInsertRowid: null };
  }

  async exec(sqlText: string): Promise<void> {
    if (this.sqlite) { this.sqlite.exec(sqlText); return; }
    const clean = this.q(sqlText).replace(/--[^\n]*/g, "");
    for (const statement of clean.split(";")) {
      const s = statement.trim();
      if (s) await this.pgQuery(s, []);
    }
  }

  async run(sqlText: string, ...params: SQLValue[]): Promise<DBResult> {
    if (this.sqlite) {
      const r = this.sqlite.prepare(sqlText).run(...params);
      return { rows: [], changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid as any };
    }
    return this.pgQuery(sqlText, params);
  }

  async get<T = Row>(sqlText: string, ...params: SQLValue[]): Promise<T | undefined> {
    if (this.sqlite) return this.sqlite.prepare(sqlText).get(...params) as T | undefined;
    return (await this.pgQuery(sqlText, params)).rows[0] as T | undefined;
  }

  async all<T = Row>(sqlText: string, ...params: SQLValue[]): Promise<T[]> {
    if (this.sqlite) return this.sqlite.prepare(sqlText).all(...params) as T[];
    return (await this.pgQuery(sqlText, params)).rows as T[];
  }

  /** معاملة ذرّية: BEGIN IMMEDIATE (SQLite) / BEGIN + عميل ثابت (Postgres) */
  async tx<T>(fn: () => Promise<T> | T): Promise<T> {
    if (this.sqlite) {
      if (this.depth > 0) return fn();
      this.depth = 1;
      await this.run("BEGIN IMMEDIATE");
      try {
        const out = await fn();
        await this.run("COMMIT");
        return out;
      } catch (e) {
        try { await this.run("ROLLBACK"); } catch { /* ignore */ }
        throw e;
      } finally { this.depth = 0; }
    }
    const existing = this.txClient.getStore();
    if (existing) return fn();
    const client = await this.pool!.connect();
    this.txQueue = Promise.resolve();
    try {
      await client.query("BEGIN");
      const out = await this.txClient.run(client, fn);
      await this.txQueue;
      await client.query("COMMIT");
      return out;
    } catch (e) {
      await this.txQueue.catch(() => {});
      try { await client.query("ROLLBACK"); } catch { /* ignore */ }
      throw e;
    } finally {
      client.release();
    }
  }

  private depth = 0;

  close() {
    this.sqlite?.close();
    if (this.pool) void this.pool.end().catch(() => {});
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
      // 003 يحدث بيانات قديمة بدوال JSON خاصة بـ SQLite؛ قوالبنا الجديدة مبذَرة بالهوية الجديدة
      if (!(db.mode === "neon" && file.startsWith("003_"))) {
        await db.exec(db.mode === "neon" ? adaptSql(sqlText) : sqlText);
      }
      await db.run("INSERT INTO schema_migrations (version) VALUES (?)", version);
    });
  }
}

/** تكييف SQL من SQLite إلى Postgres (يغطي أنماط ملفات الهجرة لدينا). */
export function adaptSql(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")
    .replace(/strftime\('%Y-%m-%dT%H:%M:%fZ'\s*,\s*'now'\)/g, PG_NOW)
    .replace(/datetime\('\s*now\s*'\)/g, PG_NOW)
    .replace(/\bAUTOINCREMENT\b/g, "")
    .replace(/\bINSERT\s+OR\s+IGNORE\b/gi, "INSERT")
    .replace(/\bGLOB\b/g, "LIKE");
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
  return createDb(":memory:");
}
