import fs from "node:fs";
for (const f of fs.readdirSync("tests").filter(f => f.endsWith(".test.ts"))) {
  const p = "tests/" + f;
  let s = fs.readFileSync(p, "utf8");
  const before = s;
  s = s.replace(/(?<!Async)\bexpectAppError\s*\(/g, "await expectAppErrorAsync(");
  // imports: replace expectAppError with expectAppErrorAsync (dedupe)
  s = s.replace(/import \{([^}]*)\} from "\.\/helpers";/, (m, names) => {
    const set = new Set(names.split(",").map(x => x.trim()).filter(Boolean).map(x => x === "expectAppError" ? "expectAppErrorAsync" : x));
    return `import { ${[...set].join(", ")} } from "./helpers";`;
  });
  s = s.replace(/import \{([^}]*)\} from "@\/tests\/helpers";/, (m, names) => {
    const set = new Set(names.split(",").map(x => x.trim()).filter(Boolean).map(x => x === "expectAppError" ? "expectAppErrorAsync" : x));
    return `import { ${[...set].join(", ")} } from "@/tests/helpers";`;
  });
  if (s !== before) { fs.writeFileSync(p, s); console.log("fixed", p); }
}
