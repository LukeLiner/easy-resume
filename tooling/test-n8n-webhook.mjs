#!/usr/bin/env node
/**
 * 测试 N8N webhook 地址是否能调通。
 *
 * 用法：
 *   node tooling/test-n8n-webhook.mjs [url] [option] [username] [password]
 *
 * 说明：
 *   - 不传 url 时，自动读取仓库根目录 .env 中的 PAYMENT_N8N_WEBHOOK_URL。
 *   - 不传 option 时，依次测试 register 和 charge 两种。
 *   - Basic Auth 默认读取 .env 中的 PAYMENT_N8N_WEBHOOK_USERNAME / PASSWORD，
 *     也可通过命令行第 3、4 个参数临时覆盖。
 *   - 与生产逻辑 triggerN8nWebhook 一致：GET 请求，携带 option 参数。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readEnvValue(envPath, key) {
	try {
		const content = readFileSync(envPath, "utf8");
		const match = content.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, "m"));
		if (match) return match[1].trim().replace(/^["']|["']$/g, "");
	} catch {
		// 文件不存在时返回 undefined
	}
	return undefined;
}

function getWebhookUrl(argvUrl) {
	if (argvUrl) return argvUrl;

	const url = readEnvValue(resolve(import.meta.dirname, "../.env"), "PAYMENT_N8N_WEBHOOK_URL");
	if (url) return url;

	console.error("未提供 url，且 .env 中未找到 PAYMENT_N8N_WEBHOOK_URL");
	process.exit(1);
}

function getAuth(argvUsername, argvPassword) {
	const envPath = resolve(import.meta.dirname, "../.env");
	const username = argvUsername ?? readEnvValue(envPath, "PAYMENT_N8N_WEBHOOK_USERNAME");
	const password = argvPassword ?? readEnvValue(envPath, "PAYMENT_N8N_WEBHOOK_PASSWORD");
	if (!username || !password) return undefined;
	return { username, password };
}

function basicAuthHeader(auth) {
	return `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString("base64")}`;
}

async function testOnce(url, option, auth) {
	const parsed = new URL(url);
	parsed.searchParams.set("option", option);

	const headers = {};
	if (auth) headers.Authorization = basicAuthHeader(auth);

	const started = Date.now();
	try {
		const res = await fetch(parsed, { method: "GET", headers });
		const body = await res.text();
		const ms = Date.now() - started;
		const ok = res.ok;
		console.log(`[${ok ? "PASS" : "FAIL"}] ${option.padEnd(8)} -> ${parsed.toString()}`);
		console.log(`        status=${res.status} time=${ms}ms body=${body.slice(0, 200) || "(empty)"}`);
		return ok;
	} catch (error) {
		const ms = Date.now() - started;
		console.log(`[FAIL] ${option.padEnd(8)} -> ${parsed.toString()}`);
		console.log(`        time=${ms}ms error=${error.message}`);
		return false;
	}
}

const [, , argvUrl, argvOption, argvUsername, argvPassword] = process.argv;
const url = getWebhookUrl(argvUrl);
const auth = getAuth(argvUsername, argvPassword);
const options = argvOption ? [argvOption] : ["register", "charge"];

console.log(`webhook: ${url}`);
console.log(`auth: ${auth ? `${auth.username}:${auth.password.replace(/./g, "*")}` : "(none)"}`);
console.log("----------------------------------------");
const results = await Promise.all(options.map((option) => testOnce(url, option, auth)));
const passed = results.filter(Boolean).length;
console.log("----------------------------------------");
console.log(`${passed}/${results.length} 个请求成功`);
process.exit(passed === results.length ? 0 : 1);
