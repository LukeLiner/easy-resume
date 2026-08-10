import { createRequire } from "node:module";
import { generateText, generateObject, streamObject, streamText } from "ai";

const require_ = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let wrapAISDKModel: ((model: any, options?: Record<string, unknown>) => any) | undefined;

function maskKey(key: string | undefined): string {
	if (!key) return "<not set>";
	if (key.length <= 12) return `${key.slice(0, 4)}****`;
	return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

const langsmithEnv = {
	LANGSMITH_API_KEY: process.env.LANGSMITH_API_KEY,
	LANGSMITH_ENDPOINT: process.env.LANGSMITH_ENDPOINT,
	LANGSMITH_PROJECT: process.env.LANGSMITH_PROJECT,
	LANGSMITH_TRACING: process.env.LANGSMITH_TRACING,
	LANGSMITH_ENABLED: process.env.LANGSMITH_ENABLED,
};

console.info("[langsmith] Initializing — env:", {
	TRACING: langsmithEnv.LANGSMITH_TRACING ?? "<not set>",
	ENABLED: langsmithEnv.LANGSMITH_ENABLED ?? "<not set>",
	ENDPOINT: langsmithEnv.LANGSMITH_ENDPOINT ?? "<not set>",
	PROJECT: langsmithEnv.LANGSMITH_PROJECT ?? "<not set>",
	API_KEY: maskKey(langsmithEnv.LANGSMITH_API_KEY),
});

const enabled =
	langsmithEnv.LANGSMITH_API_KEY ||
	langsmithEnv.LANGSMITH_TRACING === "true" ||
	langsmithEnv.LANGSMITH_ENABLED === "true";

if (!langsmithEnv.LANGSMITH_TRACING || langsmithEnv.LANGSMITH_TRACING !== "true") {
	console.warn(
		"[langsmith] WARNING: LANGSMITH_TRACING is not set to 'true'. " +
			"The langsmith library checks this flag to decide whether to send traces. " +
			"Add LANGSMITH_TRACING=true to your .env to fix.",
	);
}

if (!enabled) {
	console.info("[langsmith] Tracing disabled — set LANGSMITH_API_KEY or LANGSMITH_TRACING=true to enable");
}

if (enabled) {
	try {
		const { wrapAISDKModel: _wrapAISDKModel } = require_("langsmith/wrappers/vercel");
		wrapAISDKModel = _wrapAISDKModel;
		console.info("[langsmith] wrapAISDKModel loaded — all AI SDK calls (including ToolLoopAgent) are now traced");
	} catch (error) {
		console.error("[langsmith] wrapAISDKModel failed:", error);
	}
}

export { generateObject, generateText, streamObject, streamText, wrapAISDKModel };
