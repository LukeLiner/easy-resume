import { createRequire } from "node:module";
import { generateText as _generateText, generateObject as _generateObject, streamObject as _streamObject, streamText as _streamText, wrapLanguageModel } from "ai";

const require_ = createRequire(import.meta.url);

let generateText = _generateText;
let streamText = _streamText;
let generateObject = _generateObject;
let streamObject = _streamObject;

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

if (!enabled) {
	console.info("[langsmith] Tracing disabled — set LANGSMITH_API_KEY or LANGSMITH_TRACING=true to enable");
}

if (enabled) {
	try {
		const { wrapAISDK } = require_("langsmith/experimental/vercel");
		const wrapped = wrapAISDK({
			generateText: _generateText,
			generateObject: _generateObject,
			streamObject: _streamObject,
			streamText: _streamText,
			wrapLanguageModel,
		});
		generateText = wrapped.generateText;
		streamText = wrapped.streamText;
		generateObject = wrapped.generateObject;
		streamObject = wrapped.streamObject;
		console.info("[langsmith] wrapAISDK succeeded — generateText & streamText are now traced");
	} catch (error) {
		console.error("[langsmith] wrapAISDK failed:", error);
	}
}

export { generateObject, generateText, streamObject, streamText };
