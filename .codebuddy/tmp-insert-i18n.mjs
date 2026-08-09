import fs from "node:fs";

const jobs = [
  {
    path: "apps/web/locales/zh-CN.po",
    anchor: 'msgid "Click here to select a file to import"\r\nmsgstr "\u70b9\u51fb\u6b64\u5904\u9009\u62e9\u8981\u5bfc\u5165\u7684\u6587\u4ef6"',
    insert:
      '\r\n#: src/routes/builder/$resumeId/-sidebar/right/sections/template.tsx\r\nmsgid "Click the preview to switch templates"\r\nmsgstr "\u70b9\u51fb\u9884\u89c8\u4ee5\u5207\u6362\u6a21\u677f"',
  },
  {
    path: "apps/web/locales/en-US.po",
    anchor: 'msgid "Click here to select a file to import"\r\nmsgstr "Click here to select a file to import"',
    insert:
      '\r\n#: src/routes/builder/$resumeId/-sidebar/right/sections/template.tsx\r\nmsgid "Click the preview to switch templates"\r\nmsgstr "Click the preview to switch templates"',
  },
];

for (const job of jobs) {
  let content = fs.readFileSync(job.path, "utf8");
  if (content.includes(job.insert.trim())) {
    console.log(`ALREADY: ${job.path}`);
    continue;
  }
  if (!content.includes(job.anchor)) {
    console.log(`ANCHOR NOT FOUND: ${job.path}`);
    continue;
  }
  content = content.replace(job.anchor, job.anchor + job.insert);
  fs.writeFileSync(job.path, content);
  console.log(`OK: ${job.path}`);
}
