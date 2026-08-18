const fs = require("fs");

const files = [
	"apps/web/src/routes/builder/$resumeId/-sidebar/right/sections/job-radar.tsx",
	"apps/web/src/routes/builder/$resumeId/-sidebar/right/sections/job-radar-dimensions.tsx",
	"apps/web/src/routes/builder/$resumeId/-sidebar/right/sections/job-radar-gaps.tsx",
	"apps/web/src/routes/builder/$resumeId/-sidebar/right/sections/job-radar-suggestions.tsx",
	"apps/web/src/routes/builder/$resumeId/-sidebar/right/sections/job-radar-summary.tsx",
	"apps/web/src/libs/resume/section.tsx",
	"apps/web/src/routes/builder/$resumeId/-components/combined-sidebar.tsx",
];

const msgids = new Set();
for (const f of files) {
	const s = fs.readFileSync(f, "utf8");
	const re = /\bt`([^`]+)`/g;
	let m;
	while ((m = re.exec(s))) msgids.add(m[1]);
}

const poZh = fs.readFileSync("apps/web/locales/zh-CN.po", "utf8");
const poEn = fs.readFileSync("apps/web/locales/en-US.po", "utf8");

const missing = [];
for (const id of msgids) {
	const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const re = new RegExp('^msgid "' + esc + '"$', "m");
	if (!re.test(poZh) || !re.test(poEn)) missing.push(id);
}

console.log("msgids:", msgids.size);
console.log("missing:", JSON.stringify(missing, null, 2));
