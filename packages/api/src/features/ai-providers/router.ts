import type { AiProviderResponse } from "./service";
import { ORPCError } from "@orpc/client";
import { type } from "@orpc/server";
import z from "zod";
import { adminProcedure, protectedProcedure } from "../../context";
import { aiRequestRateLimit } from "../../middleware/rate-limit";
import { providerInput, updateProviderInput } from "./inputs";
import { aiProvidersService } from "./service";

function isInvalidAiBaseUrl(error: unknown) {
	return error instanceof Error && error.message === "INVALID_AI_BASE_URL";
}

function throwInvalidProviderConfig(): never {
	throw new ORPCError("BAD_REQUEST", { message: "Invalid AI provider configuration." });
}

export const aiProvidersRouter = {
	list: protectedProcedure
		.route({
			method: "GET",
			path: "/ai-providers",
			tags: ["AI Providers"],
			operationId: "listAiProviders",
			summary: "List saved AI providers",
			description: "Lists saved provider/model/API key combinations for the authenticated user. API keys are redacted.",
		})
		.output(type<AiProviderResponse[]>())
		.errors({
			PRECONDITION_FAILED: { message: "AI agent workspace is not configured.", status: 412 },
		})
		.handler(() => aiProvidersService.list()),

	create: adminProcedure
		.route({
			method: "POST",
			path: "/ai-providers",
			tags: ["AI Providers"],
			operationId: "createAiProvider",
			summary: "Create global AI provider",
			description: "Stores an encrypted provider/model/API key combination shared by all users. The key is never returned.",
		})
		.input(providerInput)
		.output(type<AiProviderResponse>())
		.errors({
			BAD_REQUEST: { message: "Invalid AI provider configuration.", status: 400 },
			PRECONDITION_FAILED: { message: "AI agent workspace is not configured.", status: 412 },
		})
		.handler(async ({ input }) => {
			try {
				return await aiProvidersService.create({
					label: input.label,
					provider: input.provider,
					model: input.model,
					...(input.baseURL !== undefined ? { baseURL: input.baseURL } : {}),
					apiKey: input.apiKey,
				});
			} catch (error) {
				if (isInvalidAiBaseUrl(error)) throwInvalidProviderConfig();
				throw error;
			}
		}),

	update: adminProcedure
		.route({
			method: "PATCH",
			path: "/ai-providers/{id}",
			tags: ["AI Providers"],
			operationId: "updateAiProvider",
			summary: "Update global AI provider",
			description:
				"Updates a global provider/model/API key combination. Updating the key requires retesting before use.",
		})
		.input(updateProviderInput)
		.output(type<AiProviderResponse>())
		.errors({
			BAD_REQUEST: { message: "Invalid AI provider configuration.", status: 400 },
			NOT_FOUND: { message: "AI provider was not found.", status: 404 },
			PRECONDITION_FAILED: { message: "AI agent workspace is not configured.", status: 412 },
		})
		.handler(async ({ input }) => {
			try {
				return await aiProvidersService.update({
					id: input.id,
					...(input.label !== undefined ? { label: input.label } : {}),
					...(input.provider !== undefined ? { provider: input.provider } : {}),
					...(input.model !== undefined ? { model: input.model } : {}),
					...(input.baseURL !== undefined ? { baseURL: input.baseURL } : {}),
					...(input.apiKey !== undefined ? { apiKey: input.apiKey } : {}),
					...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
				});
			} catch (error) {
				if (isInvalidAiBaseUrl(error)) throwInvalidProviderConfig();
				throw error;
			}
		}),

	delete: adminProcedure
		.route({
			method: "DELETE",
			path: "/ai-providers/{id}",
			tags: ["AI Providers"],
			operationId: "deleteAiProvider",
			summary: "Delete global AI provider",
			description: "Deletes a global provider/model/API key combination.",
		})
		.input(z.object({ id: z.string() }))
		.output(z.void())
		.errors({
			PRECONDITION_FAILED: { message: "AI agent workspace is not configured.", status: 412 },
		})
		.handler(({ input }) => aiProvidersService.delete({ id: input.id })),

	test: adminProcedure
		.route({
			method: "POST",
			path: "/ai-providers/{id}/test",
			tags: ["AI Providers"],
			operationId: "testAiProvider",
			summary: "Test global AI provider",
			description: "Decrypts the saved API key server-side and validates the provider/model connection.",
		})
		.input(z.object({ id: z.string() }))
		.output(type<AiProviderResponse>())
		.use(aiRequestRateLimit)
		.errors({
			BAD_REQUEST: { message: "Invalid AI provider configuration.", status: 400 },
			BAD_GATEWAY: { message: "The AI provider returned an error or is unreachable.", status: 502 },
			NOT_FOUND: { message: "AI provider was not found.", status: 404 },
			PRECONDITION_FAILED: { message: "AI agent workspace is not configured.", status: 412 },
		})
		.handler(async ({ input }) => {
			try {
				return await aiProvidersService.test({ id: input.id });
			} catch (error) {
				if (isInvalidAiBaseUrl(error)) throwInvalidProviderConfig();
				if (error instanceof ORPCError) throw error;
				throw new ORPCError("BAD_GATEWAY", { message: "Could not reach the AI provider." });
			}
		}),
};
