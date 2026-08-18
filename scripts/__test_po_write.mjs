import { readFileSync, writeFileSync } from "node:fs";

const f = "d:/code/github/reactive-resume/apps/web/locales/zh-CN.po";
const c = readFileSync(f, "utf8");
console.log("before has TEST:", c.includes("AfterTEST"));
const n = c.replace('msgid "After"', 'msgid "AfterTEST"');
writeFileSync(f, n, "utf8");
const v = readFileSync(f, "utf8");
console.log("after has TEST:", v.includes("AfterTEST"));
