const fs = require("fs");
const path = require("path");
const dir = "d:/code/github/reactive-resume/apps/web/locales";

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".po"));

let converted = 0;
for (const f of files) {
  const p = path.join(dir, f);
  const s = fs.readFileSync(p, "utf8");
  if (s.includes("\n") && !s.includes("\r\n")) {
    const normalized = s.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
    fs.writeFileSync(p, normalized, "utf8");
    converted++;
  }
}
console.log("Converted to CRLF:", converted, "of", files.length);
