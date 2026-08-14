const fs = require("fs");
const path = "d:/code/github/reactive-resume/apps/web/locales/zh-CN.po";

let s = fs.readFileSync(path, "utf8");

const hasCRLF = s.includes("\r\n");
const hasLFOnly = s.includes("\n") && !hasCRLF;
console.log("CRLF present:", hasCRLF, "| LF-only:", hasLFOnly);

const translations = {
  Account: "账号",
  Active: "正常",
  Amount: "金额",
  "Attachment download": "附件下载",
  Balance: "余额",
  Banned: "已封禁",
  "No transactions yet.": "暂无使用明细",
  "Page {page} of {totalPages} ({total} total)": "第 {page} 页，共 {totalPages} 页（共 {total} 条）",
  Pending: "待审核",
  "Remaining Balance": "剩余金额",
  Remark: "备注",
  "Resume analysis": "简历分析",
  "Resume generation conversation": "简历生成对话",
  Status: "状态",
  Time: "时间",
  "Usage Details": "使用明细",
  "User Center": "用户中心",
};

let applied = 0;
let missing = [];

for (const [msgid, msgstr] of Object.entries(translations)) {
  const nl = hasCRLF ? "\r\n" : "\n";
  const oldStr = `msgid "${msgid}"${nl}msgstr ""`;
  const newStr = `msgid "${msgid}"${nl}msgstr "${msgstr}"`;
  if (s.includes(oldStr)) {
    s = s.split(oldStr).join(newStr);
    applied++;
  } else {
    missing.push(msgid);
  }
}

fs.writeFileSync(path, s, "utf8");

console.log("Applied:", applied, "/", Object.keys(translations).length);
if (missing.length) console.log("MISSING:", JSON.stringify(missing));

// verify
const s2 = fs.readFileSync(path, "utf8");
const i = s2.indexOf('msgid "User Center"');
console.log("Verify User Center:", JSON.stringify(s2.slice(i, i + 50)));
