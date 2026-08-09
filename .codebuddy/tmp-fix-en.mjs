import fs from "node:fs";

const p = "apps/web/locales/en-US.po";
let c = fs.readFileSync(p, "utf8");
const bad = 'msgstr "Click here to select a file to import"\r\n#: src/routes/builder';
if (c.includes(bad)) {
  c = c.replace(bad, 'msgstr "Click here to select a file to import"\r\n\r\n#: src/routes/builder');
  fs.writeFileSync(p, c);
  console.log("FIXED");
} else {
  console.log("SKIP");
}
