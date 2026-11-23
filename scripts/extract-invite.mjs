import fs from "node:fs";
const s = fs.readFileSync("C:/Users/ديل/Downloads/laylatna-planner-single.html", "utf8");
const i = s.indexOf("function renderInvite");
console.log("renderInvite at", i);
// print surrounding function if found
if (i >= 0) console.log(s.slice(i, i + 6000));
