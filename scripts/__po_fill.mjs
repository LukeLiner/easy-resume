import { readFileSync, writeFileSync } from "node:fs";

const f = "d:/code/github/reactive-resume/apps/web/locales/zh-CN.po";
let c = readFileSync(f, "utf8");

const pairs = [
	['msgid "Polishing…"\nmsgstr ""', 'msgid "Polishing…"\nmsgstr "优化中……"'],
	[
		'msgid "Something went wrong while analyzing the job description."\nmsgstr ""',
		'msgid "Something went wrong while analyzing the job description."\nmsgstr "分析职位描述时出错。"',
	],
	[
		'msgid "Something went wrong while restoring your resume."\nmsgstr ""',
		'msgid "Something went wrong while restoring your resume."\nmsgstr "恢复简历时出错。"',
	],
	[
		'msgid "Tip: Use the suggestions below to weave missing keywords into your existing experience and skills sections — never invent achievements."\nmsgstr ""',
		'msgid "Tip: Use the suggestions below to weave missing keywords into your existing experience and skills sections — never invent achievements."\nmsgstr "提示：使用下方建议，将缺失关键词融入你已有的经历与技能模块——切勿虚构成果。"',
	],
	[
		'msgid "You have exceeded your resume analysis quota."\nmsgstr ""',
		'msgid "You have exceeded your resume analysis quota."\nmsgstr "你的简历分析次数已用尽。"',
	],
];

let hit = 0;
for (const [from, to] of pairs) {
	if (c.includes(from)) {
		c = c.split(from).join(to);
		hit += 1;
	} else {
		console.log("MISS:", from.split("\n")[0]);
	}
}

writeFileSync(f, c, "utf8");
console.log("done, replaced:", hit, "of", pairs.length);
