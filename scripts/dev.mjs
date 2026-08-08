import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_WEB = path.resolve(__dirname, "../apps/web");

const COMPOSE_FILE = "compose.dev.yml";

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function runSync(cmd) {
	try {
		execSync(cmd, { stdio: "inherit" });
	} catch {
		// non-fatal: service might already be running
	}
}

async function main() {
	// 1. Start Docker services (PostgreSQL + Redis)
	console.log("[dev] Starting Docker services...");
	runSync(`docker compose -f ${COMPOSE_FILE} up -d postgres redis`);

	// 2. Wait for PostgreSQL to be ready
	console.log("[dev] Waiting for PostgreSQL...");
	for (let i = 0; i < 30; i++) {
		try {
			execSync(
				`docker compose -f ${COMPOSE_FILE} exec -T postgres pg_isready -U postgres -d postgres`,
				{ stdio: "pipe" },
			);
			console.log("[dev] PostgreSQL is ready.");
			break;
		} catch {
			if (i === 29) {
				console.error("[dev] PostgreSQL failed to start within 60s. Check Docker.");
				process.exit(1);
			}
			await sleep(2000);
		}
	}

	// 3. Start both dev servers directly (bypass turbo to avoid Windows concurrency issues)
	console.log("[dev] Starting API server  -> http://localhost:3001");
	console.log("[dev] Starting Web dev server -> http://localhost:3000");
	console.log("");

	const children = [];

	const serverProcess = spawn("pnpm", ["run", "dev"], {
		stdio: "inherit",
		shell: true,
		cwd: path.resolve(__dirname, "../apps/server"),
	});
	children.push(serverProcess);

	const webProcess = spawn("pnpm", ["run", "dev"], {
		stdio: "inherit",
		shell: true,
		cwd: APP_WEB,
	});
	children.push(webProcess);

	// Graceful shutdown: kill all children on Ctrl+C
	const shutdown = () => {
		console.log("\n[dev] Shutting down...");
		for (const child of children) {
			if (child && !child.killed) {
				if (process.platform === "win32") {
					execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
				} else {
					child.kill("SIGINT");
				}
			}
		}
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	// If any child exits unexpectedly, shut down everything
	Promise.race(children.map((c) => new Promise((resolve) => c.on("exit", resolve)))).then((exitCode) => {
		if (exitCode !== 0 && exitCode !== null) {
			console.error(`\n[dev] A dev server exited with code ${exitCode}`);
		}
		shutdown();
	});
}

main();
