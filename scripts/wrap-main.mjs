import fs from "node:fs";
for (const f of ["db/seed.ts", "scripts/set-admin.ts"]) {
  const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) if (/^import\s/.test(lines[i])) lastImport = i;
  const before = lines.slice(0, lastImport + 1);
  const body = lines.slice(lastImport + 1);
  const out = [...before, "", "async function main() {", ...body.map(l => "  " + l), "}", "", "main().catch((e) => { console.error(e); process.exit(1); });", ""].join("\n");
  fs.writeFileSync(f, out);
  console.log("wrapped", f);
}
