import { readFileSync, writeFileSync } from "node:fs";

const f = "d:/code/github/reactive-resume/apps/web/locales/zh-CN.po";
let c = readFileSync(f, "utf8");

const pairs = [
	['msgid "After"\nmsgstr ""', 'msgid "After"\nmsgstr "优化后"'],
	['msgid "Analyze Job Match"\nmsgstr ""', 'msgid "Analyze Job Match"\nmsgstr "分析职位匹配度"'],
	['msgid "Before"\nmsgstr ""', 'msgid "Before"\nmsgstr "优化前"'],
	['msgid "Comparing skills & experience"\nmsgstr ""', 'msgid "Comparing skills & experience"\nmsgstr "对比技能与经验"'],
	['msgid "Covered"\nmsgstr ""', 'msgid "Covered"\nmsgstr "已覆盖"'],
	['msgid "Failed to analyze job description."\nmsgstr ""', 'msgid "Failed to analyze job description."\nmsgstr "职位描述分析失败。"'],
	['msgid "Generating rewrite suggestions"\nmsgstr ""', 'msgid "Generating rewrite suggestions"\nmsgstr "生成改写建议"'],
	['msgid "Job match analysis complete."\nmsgstr ""', 'msgid "Job match analysis complete."\nmsgstr "职位匹配分析已完成。"'],
	['msgid "Keyword"\nmsgstr ""', 'msgid "Keyword"\nmsgstr "关键词"'],
	['msgid "Match score"\nmsgstr ""', 'msgid "Match score"\nmsgstr "匹配分数"'],
	['msgid "Matched"\nmsgstr ""', 'msgid "Matched"\nmsgstr "已匹配"'],
	['msgid "Missing or weak"\nmsgstr ""', 'msgid "Missing or weak"\nmsgstr "缺失或薄弱"'],
	['msgid "Parsing the job description"\nmsgstr ""', 'msgid "Parsing the job description"\nmsgstr "解析职位描述"'],
	['msgid "Paste the job description here…"\nmsgstr ""', 'msgid "Paste the job description here…"\nmsgstr "在此粘贴职位描述……"'],
	['msgid "Previous analyses"\nmsgstr ""', 'msgid "Previous analyses"\nmsgstr "历史分析"'],
	['msgid "Requirement Coverage"\nmsgstr ""', 'msgid "Requirement Coverage"\nmsgstr "要求覆盖情况"'],
	['msgid "Scoring keyword coverage"\nmsgstr ""', 'msgid "Scoring keyword coverage"\nmsgstr "评估关键词覆盖"'],
	['msgid "Six-Dimension Analysis"\nmsgstr ""', 'msgid "Six-Dimension Analysis"\nmsgstr "六维分析"'],
	['msgid "What will change"\nmsgstr ""', 'msgid "What will change"\nmsgstr "改动前后对比"'],
];

const longPairs = [
	[
		'msgid "Paste a job description to get a detailed match analysis with a score, gaps, and tailored suggestions. To activate this feature, please update your AI settings."\nmsgstr ""',
		'msgid "Paste a job description to get a detailed match analysis with a score, gaps, and tailored suggestions. To activate this feature, please update your AI settings."\nmsgstr "粘贴职位描述，即可获得包含评分、差距与定制化建议的详细匹配分析。如需启用该功能，请先更新你的 AI 设置。"',
	],
	[
		'msgid "Paste a job description to see how well your resume matches it, and get tailored suggestions to make it stand out."\nmsgstr ""',
		'msgid "Paste a job description to see how well your resume matches it, and get tailored suggestions to make it stand out."\nmsgstr "粘贴职位描述，查看你的简历与之匹配程度，并获得针对性建议，让你的简历脱颖而出。"',
	],
	[
		'msgid "Run your first analysis to see how well your resume matches this job."\nmsgstr ""',
		'msgid "Run your first analysis to see how well your resume matches this job."\nmsgstr "运行首次分析，查看你的简历与该职位的匹配程度。"',
	],
];

const all = [...pairs, ...longPairs];
let hit = 0;
for (const [from, to] of all) {
	if (c.includes(from)) {
		c = c.split(from).join(to);
		hit += 1;
	} else {
		console.log("MISS:", from.split("\n")[0]);
	}
}

writeFileSync(f, c, "utf8");
console.log("done, replaced:", hit, "of", all.length);
