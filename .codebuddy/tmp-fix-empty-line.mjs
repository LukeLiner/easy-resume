import fs from "node:fs";

const files = ["apps/web/locales/zh-CN.po", "apps/web/locales/en-US.po"];

for (const path of files) {
  let content = fs.readFileSync(path, "utf8");
  const bad = 'msgstr "\u70b9\u51fb\u6b64\u5904\u9009\u62e9\u8981\u5bfc\u5165\u7684\u6587\u4ef6"\r\n#: src/routes/builder';
  if (content.includes(bad)) {
    content = content.replace(bad, 'msgstr "\u70b9\u51fb\u6b64\u5904\u9009\u62e9\u8981\u5bfc\u5165\u7684\u6587\u4ef6"\r\n\r\n#: src/routes/builder');
    fs.writeFileSync(path, content);
    console.log(`FIXED: ${path}`);
  } else {
    console.log(`SKIP: ${path}`);
  }
}
