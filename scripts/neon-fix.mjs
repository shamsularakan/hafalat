/** AST-based async/await fixer for the Neon conversion. Preserves formatting via positional edits. */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOTS = ["src", "tests", "db", "scripts"];
const files = [];
for (const root of ROOTS) {
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name) && !/codemod|neon-fix|analyze/.test(e.name) && !/src[\\/](app[\\/]app|components)[\\/]/.test(p)) files.push(p.replace(/\\/g, "/"));
    }
  };
  walk(root);
}

const DB_METHODS = new Set(["get", "all", "run", "exec", "tx"]);
const SYNC_ONLY = new Set(["err", "route", "newId", "nowIso", "parseCsv", "toCsv", "hashPassword", "verifyPassword", "normalizeEmail", "normalizePhone", "phoneHash", "hashSessionToken", "newSessionToken", "readJson", "clientIp", "ok", "fail", "rateLimit", "escapeRe", "clientIp"]);

function parse(f, text) {
  return ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}
function fnNodes(sf) {
  const out = [];
  const visit = (n) => {
    if (ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n) || ts.isArrowFunction(n) || ts.isFunctionExpression(n)) out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
function isAsyncNode(n) { return !!(n.modifiers && n.modifiers.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)); }
function callName(call, text, sf) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) {
    if (DB_METHODS.has(e.name.text) && (/[)>]?\b(?:db|getDb\(\))\s*\)?\s*$/.test(e.expression.getText(sf).trim()) || call.typeArguments)) return "__DB__";
    return null;
  }
  return null;
}
function bodyHasAwait(n, text) {
  let found = false;
  const visit = (c) => { if (ts.isAwaitExpression(c)) found = true; ts.forEachChild(c, visit); };
  if (n.body) visit(n.body);
  return found;
}
function bodyCallsAny(n, names, text, sf) {
  let found = false;
  const visit = (c) => {
    if (ts.isCallExpression(c)) { const nm = callName(c, text, sf); if (nm && names.has(nm)) found = true; }
    ts.forEachChild(c, visit);
  };
  if (n.body) visit(n.body);
  return found;
}

// ---- Build async name set to fixpoint ------------------------------------
const parsed = new Map();
for (const f of files) { const text = fs.readFileSync(f, "utf8"); parsed.set(f, { text, sf: parse(f, text) }); }
const asyncNames = new Set(["getDb", "createDb", "createTestDb", "writeAudit", "__DB__"]);
let changed = true, rounds = 0;
while (changed && rounds++ < 20) {
  changed = false;
  for (const { sf, text } of parsed.values()) {
    for (const n of fnNodes(sf)) {
      const name0 = n.name && ts.isIdentifier(n.name) ? n.name.text : null;
      if (name0 && !SYNC_ONLY.has(name0) && (isAsyncNode(n) || bodyHasAwait(n, text))) asyncNames.add(name0);
      if (isAsyncNode(n)) continue;
      const name = name0;
      if (name && SYNC_ONLY.has(name)) continue;
      if (name && asyncNames.has(name)) continue;
      if (bodyHasAwait(n, text) || bodyCallsAny(n, asyncNames, text, sf)) {
        if (name) { asyncNames.add(name); changed = true; }
      }
    }
  }
}
console.log("async names:", asyncNames.size);

// ---- Apply edits ----------------------------------------------------------
let totalEdits = 0;
for (const [f, { text, sf }] of parsed) {
  const edits = [];
  const fnList = fnNodes(sf);

  // function-level edits
  for (const n of fnList) {
    const name = n.name && ts.isIdentifier(n.name) ? n.name.text : null;
    const needsAsync = name ? asyncNames.has(name) : (bodyHasAwait(n, text) || bodyCallsAny(n, asyncNames, text, sf));
    if (!needsAsync) continue;
    if (isAsyncNode(n)) continue;

    // insert `async `
    let pos;
    if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)) {
      pos = text.indexOf("function", n.getStart(sf));
    } else if (ts.isMethodDeclaration(n)) {
      pos = n.name.getStart(sf);
    } else { // arrow: insert at start (before modifiers like export)
      pos = n.getStart(sf);
    }
    if (pos >= 0) edits.push({ start: pos, end: pos, text: "async " });

    // wrap return type in Promise<T>
    if (n.type && n.type.getStart(sf) >= 0) {
      const t = text.slice(n.type.getStart(sf), n.type.getEnd());
      if (!/^Promise\s*</.test(t)) edits.push({ start: n.type.getStart(sf), end: n.type.getEnd(), text: `Promise<${t}>` });
    }
  }

  // call-level edits
  const visit = (c) => {
    if (ts.isCallExpression(c) && c.getStart(sf) >= 0) {
      const nm = callName(c, text, sf);
      const parentIsAwait = ts.isAwaitExpression(c.parent) && c.parent.expression === c;
      if (!parentIsAwait && nm && asyncNames.has(nm)) {
        const s = c.getStart(sf), e = c.getEnd();
        edits.push({ start: s, end: e, text: `(await ${text.slice(s, e)})` });
      }
    }
    ts.forEachChild(c, visit);
  };
  visit(sf);

  // dedupe overlapping edits (prefer larger), apply end→start
  edits.sort((a, b) => b.start - a.start || (b.end - b.start) - (a.end - a.start));
  let out = text, lastStart = Infinity;
  let count = 0;
  for (const ed of edits) {
    if (ed.end > lastStart) continue; // overlaps already-applied edit
    out = out.slice(0, ed.start) + ed.text + out.slice(ed.end);
    lastStart = ed.start;
    count++;
  }
  if (count) { fs.writeFileSync(f, out); totalEdits += count; }
}
console.log("edits applied:", totalEdits);
