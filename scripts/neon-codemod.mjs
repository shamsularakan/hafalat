/**
 * Neon async conversion codemod — two-phase, offset-safe.
 */
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "tests", "db", "scripts"];
const files = [];
for (const root of ROOTS) {
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && !/codemod|analyze/.test(e.name) && !/src[\\/](app[\\/]app|components)[\\/]/.test(p)) files.push(p.replace(/\\/g, "/"));
    }
  };
  walk(root);
}

function match(s, openIdx, open, close) {
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// ---- Definition discovery ------------------------------------------------
// returns { name?, headStart, headEnd, bodyStart, bodyEnd, kind }
function findDefs(s) {
  const defs = [];
  // function declarations & const arrow functions
  const re1 = /(?:^|\n)([ \t]*)((?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g;
  for (const m of s.matchAll(re1)) {
    const indent = m[1];
    const start = m.index + 1;
    let i = s.indexOf("{", m.index + m[0].length - 1);
    if (i < 0) continue;
    const end = match(s, i, "{", "}");
    if (end < 0) continue;
    defs.push({ name: m[3] || m[4], headStart: start, headEnd: i, bodyStart: i, bodyEnd: end, kind: m[3] ? "function" : "arrow", indent });
  }
  // class / object methods:  name(args): Type {
  const re2 = /(?:^|\n)([ \t]*)((?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*(?::[^{=;\n]+)?\s*\{)/g;
  for (const m of s.matchAll(re2)) {
    const name = m[3];
    if (!name || ["if", "for", "while", "switch", "catch", "function", "return", "constructor", "get", "set", "route", "describe", "it", "test", "expect", "with"].includes(name)) continue;
    const i = s.indexOf("{", m.index + m[0].length - 1);
    const end = match(s, i, "{", "}");
    if (end < 0) continue;
    defs.push({ name, headStart: m.index + 1, headEnd: i, bodyStart: i, bodyEnd: end, kind: "method", indent: m[1] });
  }
  // it()/describe()/test() callbacks:  it("...", () => {
  const re3 = /(?:^|\n)([ \t]*)\b(it|describe|test)\s*\(\s*(['"`][^'"`]*['"`])\s*,\s*(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g;
  for (const m of s.matchAll(re3)) {
    const i = s.indexOf("{", m.index + m[0].length - 1);
    const end = match(s, i, "{", "}");
    if (end < 0) continue;
    defs.push({ headStart: m.index + 1, headEnd: i, bodyStart: i, bodyEnd: end, kind: "testcb", indent: m[1] });
  }
  return defs;
}

// ---- Transitive async set ------------------------------------------------
const asyncNames = new Set(["getDb", "createDb", "createTestDb", "writeAudit"]);
const SYNC_ONLY = new Set(["err", "route", "newId", "nowIso", "parseCsv", "toCsv", "hashPassword", "verifyPassword", "normalizeEmail", "normalizePhone", "phoneHash", "hashSessionToken", "newSessionToken", "readJson", "clientIp", "ok", "fail", "assertPlanGuestLimit", "escapeRe"]);
const nameDefs = [];
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  for (const d of findDefs(s)) if (d.name) nameDefs.push({ ...d, file: f, src: s });
}
function touchesAsync(body) {
  for (const n of asyncNames) if (new RegExp(`(?<![\\w$.])${n}\\s*\\(`).test(body)) return true;
  if (/\b(?:ctx\.)?db\s*\.\s*(?:get|all|run|exec|tx)\s*[(<]/.test(body)) return true;
  return false;
}
let changed = true, rounds = 0;
while (changed && rounds++ < 15) {
  changed = false;
  for (const d of nameDefs) {
    if (asyncNames.has(d.name)) continue;
    if (touchesAsync(d.src.slice(d.bodyStart, d.bodyEnd))) { asyncNames.add(d.name); changed = true; }
  }
}
for (const n of SYNC_ONLY) asyncNames.delete(n);
console.log(`async functions (${asyncNames.size})`);

// ---- Phase 1: mark async headers (on original text, end→start) -----------
function wrapReturnType(head, kind) {
  const fp = head.indexOf("(");
  if (fp < 0) return head;
  const cp = match(head, fp, "(", ")");
  if (cp < 0) return head;
  const after = head.slice(cp + 1);
  const m = after.match(/^(\s*):\s*([^{\n]+?)\s*$/);
  if (!m) return head;
  const t = m[2].trim();
  if (t.startsWith("Promise<")) return head;
  return head.slice(0, cp + 1) + `${m[1]}: Promise<${t}>` + head.slice(cp + 1 + m[0].length);
}

for (const f of files) {
  const orig = fs.readFileSync(f, "utf8");
  const defs = findDefs(orig).filter(d => d.name && asyncNames.has(d.name) && !/\basync\b/.test(orig.slice(d.headStart, d.headEnd)));
  if (!defs.length) continue;
  let s = orig;
  defs.sort((a, b) => b.headStart - a.headStart);
  for (const d of defs) {
    let head = s.slice(d.headStart, d.headEnd);
    if (d.kind === "function") head = head.replace(/\bfunction\s+/, "async function ");
    else if (d.kind === "arrow") head = head.replace(/=\s*(?=\()/, "= async ").replace(/=\s*(?=[A-Za-z_$])/, "= async ");
    else if (d.kind === "method") head = head.replace(/^(\s*)([A-Za-z_$][\w$]*)/, "$1async $2");
    head = wrapReturnType(head, d.kind);
    s = s.slice(0, d.headStart) + head + s.slice(d.headEnd);
  }
  if (s !== orig) fs.writeFileSync(f, s);
}

// ---- Phase 2: add await to calls (re-scan defs to skip headers) ----------
const DB_RE = /(?<![\w$.])(?:[A-Za-z_$][\w$]*\.)*db\s*\.\s*(?:get|all|run|exec|tx)\s*(?:<[^<>]*>)?\s*\(/;
const nameList = [...asyncNames].filter(n => n.length > 2 && !["get", "all", "run", "exec", "tx"].includes(n)).sort((a, b) => b.length - a.length);
const CALL_RE = new RegExp(`(?:${DB_RE.source}|(?<![\\w$.])(?:${nameList.map(escapeRe).join("|")})\\s*\\(|getDb\\s*\\(\\s*\\.\\s*(?:get|all|run|exec|tx)\\s*\\(|getDb\\s*\\(|createTestDb\\s*\\(|createDb\\s*\\()`, "g");

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

for (const f of files) {
  const orig = fs.readFileSync(f, "utf8");
  const skip = findDefs(orig).map(d => [d.headStart, d.headEnd]);
  let s = orig, last = 0, out = "", m;
  CALL_RE.lastIndex = 0;
  while ((m = CALL_RE.exec(s))) {
    if (skip.some(([a, b]) => m.index >= a && m.index < b)) continue;
    const before = s.slice(Math.max(0, m.index - 9), m.index);
    if (/\bawait\s*$/.test(before)) continue;
    const openIdx = s.indexOf("(", m.index);
    const closeIdx = match(s, openIdx, "(", ")");
    if (closeIdx < 0) continue;
    out += s.slice(last, m.index) + "(await " + s.slice(m.index, closeIdx + 1) + ")";
    last = closeIdx + 1;
    CALL_RE.lastIndex = last;
  }
  out += s.slice(last);
  // inline getDb().method() -> (await getDb()).method()
  out = out.replace(/\(await \(getDb\(\)\s*\.\s*(get|all|run|exec|tx)\s*\(/g, (mm, meth) => `(await (await getDb()).${meth}(`);
  out = out.replace(/\(await getDb\(\)\s*\.\s*(get|all|run|exec|tx)\s*\(/g, (mm, meth) => `(await (await getDb()).${meth}(`);
  if (out !== orig) fs.writeFileSync(f, out);
}

// ---- Phase 3: make arrow callbacks containing await async ----------------
for (const f of files) {
  const orig = fs.readFileSync(f, "utf8");
  let s = orig;
  const arrowRe = /(\([^()]*\)|[A-Za-z_$][\w$]*)\s*=>\s*\{/g;
  const edits = [];
  for (const m of s.matchAll(arrowRe)) {
    const braceIdx = m.index + m[0].length - 1;
    const end = match(s, braceIdx, "{", "}");
    if (end < 0) continue;
    const body = s.slice(braceIdx, end + 1);
    if (!/\bawait\b/.test(body)) continue;
    const start = m.index;
    const head = s.slice(start, braceIdx);
    if (/\basync\b/.test(head) || /async\s*$/.test(s.slice(Math.max(0, start - 12), start))) continue;
    edits.push({ start, head });
  }
  edits.sort((a, b) => b.start - a.start);
  for (const e of edits) {
    const nh = "async " + e.head;
    s = s.slice(0, e.start) + nh + s.slice(e.start + e.head.length);
  }
  if (s !== orig) fs.writeFileSync(f, s);
}
console.log("done");
