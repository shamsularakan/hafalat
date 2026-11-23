import fs from "node:fs";
import path from "node:path";
const files = [];
for (const root of ["src", "tests", "db", "scripts"]) {
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name)) files.push(p.replace(/\\/g, "/")); } };
  walk(root);
}
let mapCb = 0, returnDb = 0, total = 0, generic = 0;
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  total += (s.match(/\b(?:ctx\.)?db\.(get|all|run|exec|tx)\s*\(/g) || []).length;
  generic += (s.match(/\b(?:ctx\.)?db\.(get|all|run|exec|tx)\s*</g) || []).length;
  mapCb += (s.match(/\.(map|filter|forEach|some|every)\s*\([\s\S]{0,160}?\b(?:ctx\.)?db\.(get|all|run)/g) || []).length;
  returnDb += (s.match(/return\s+(?:await\s+)?(?:ctx\.)?db\.(get|all|run|exec|tx)\(/g) || []).length;
}
console.log({ files: files.length, totalDbCalls: total, genericCalls: generic, mapCallbacks: mapCb, returnDb });
