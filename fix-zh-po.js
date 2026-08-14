const fs = require("fs");
const path = "d:/code/github/reactive-resume/apps/web/locales/zh-CN.po";
let t = fs.readFileSync(path, "utf8");

const lines = t.split("\n");
let fixed = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === 'msgid "Resume Analyses"' && !fixed) {
    let j = i + 1;
    while (j < lines.length && !lines[j].trim().startsWith("msgstr ")) {
      j++;
    }
    if (j < lines.length) {
      const eol = lines[j].endsWith("\r") ? "\r" : "";
      lines[j] = 'msgstr "简历分析次数"' + eol;
      fixed = true;
    }
  }
}
t = lines.join("\n");
fs.writeFileSync(path, t, "utf8");
console.log("fixed:", fixed);
