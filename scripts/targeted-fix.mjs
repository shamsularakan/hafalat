import fs from "node:fs";
const edits = [
  ["src/server/context.ts", s => s
    .replace(/import \{ getDb \} from "@\/lib\/db";/, 'import { getDb, type DB } from "@/lib/db";')
    .replace(/db: ReturnType<typeof getDb>/g, "db: DB")
    .replace(/validateSession\(getDb\(\), raw\)/, "validateSession(await getDb(), raw)")
    .replace(/const picked = defaultOrgFor\(db, user\.id\);/, "const picked = await defaultOrgFor(db, user.id);")],
  ["src/app/api/auth/login/route.ts", s => s.replace(/const org = defaultOrgFor\(db, session\.user\.id\);/, "const org = await defaultOrgFor(db, session.user.id);")],
  ["src/app/api/auth/register/route.ts", s => s.replace(/const active = defaultOrgFor\(db, user\.id\)/, "const active = await defaultOrgFor(db, user.id)")],
  ["src/app/app/attendance/page.tsx", s => s.replace(/React\.useEffect\(async \(\) =>/, "React.useEffect(() =>")],
  ["src/app/app/statistics/page.tsx", s => s.replace(/React\.useEffect\(async \(\) =>/, "React.useEffect(() =>")],
  ["src/server/services/billing.ts", s => s.replace(/^(\s*)async (checkout\()/m, "$1$2")],
  ["src/server/services/finance.ts", s => s
    .replace(/(?<!await )\bsum\(db,/g, "await sum(db,")],
  ["src/server/services/reports.ts", s => s
    .replace("  const quota = scoped\n", "  const quota = await (scoped\n")
    .replace("      })();\n", "      })());\n")],
  ["db/seed.ts", s => s
    .replace("const guests = names.map(async", "const guests = await Promise.all(names.map(async")
    .replace("  }))\n);\n\n// إصدار دعوات", "  }))\n));\n\n// إصدار دعوات")],
  ["tests/reports.test.ts", s => s.replace(/(?<!await )\bissueInvitation\(/g, "await issueInvitation(")],
  ["tests/design-media-backup.test.ts", s => s.replace(/(?<!await )\bgetDesign\(/g, "await getDesign(").replace(/(?<!await )\bgetAsset\(/g, "await getAsset(")],
];
for (const [f, fn] of edits) {
  const text = fs.readFileSync(f, "utf8");
  const out = fn(text);
  if (out !== text) { fs.writeFileSync(f, out); console.log("fixed", f); }
}
