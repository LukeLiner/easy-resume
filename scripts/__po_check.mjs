import { readFileSync } from "node:fs";

const c = readFileSync("d:/code/github/reactive-resume/apps/web/locales/zh-CN.po", "utf8");
const lines = c.split("\n");

for (let i = 0; i < lines.length; i += 1) {
	const line = lines[i];
	if (line.startsWith("#: ") && line.includes("job-radar")) {
		let id = "";
		let str = "";
		for (let j = i + 1; j < Math.min(i + 8, lines.length); j += 1) {
			if (lines[j].startsWith("msgid ")) id = lines[j].replace("msgid ", "").trim();
			if (lines[j].startsWith("msgstr ")) str = lines[j].replace("msgstr ", "").trim();
			if (lines[j].startsWith("msgstr ") && str === '""') {
				console.log("EMPTY:", id);
				break;
			}
			if (lines[j] === "" && id) break;
		}
	}
}
