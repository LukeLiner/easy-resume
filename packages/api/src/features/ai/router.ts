import type { ResumeAnalysisStreamEvent } from "@reactive-resume/schema/resume/analysis";
import type { ResumeData } from "@reactive-resume/schema/resume/data";
import type { JobMatchStreamEvent } from "@reactive-resume/schema/resume/job-match";
import type { UIMessage } from "ai";
import { ORPCError } from "@orpc/client";
import { eventIteratorToStream, streamToEventIterator, type } from "@orpc/server";
import { AISDKError } from "ai";
import { flattenError, ZodError, z } from "zod";
import { storedResumeAnalysisSchema } from "@reactive-resume/schema/resume/analysis";
import { storedJobMatchAnalysisSchema } from "@reactive-resume/schema/resume/job-match";
import { protectedProcedure } from "../../context";
import { aiRequestRateLimit } from "../../middleware/rate-limit";
import { aiProvidersService } from "../ai-providers/service";
import { checkResumeAnalysisQuota, consumeResumeAnalysisQuota } from "../quota/service";
import { resumeService } from "../resume/service";
import { aiService, fileInputSchema } from "./service";

function isInvalidAiBaseUrlError(error: unknown): boolean {
	return error instanceof Error && error.message === "INVALID_AI_BASE_URL";
}

function isAiProviderGatewayError(error: unknown): boolean {
	return error instanceof AISDKError;
}

function isCredentialEncryptionUnavailable(error: unknown): boolean {
	return error instanceof Error && error.message === "AI_CREDENTIAL_ENCRYPTION_UNAVAILABLE";
}

/** Throws a BAD_GATEWAY ORPCError, preserving the original cause for upstream error reporters. */
function throwAiProviderGatewayError(cause?: unknown): never {
	throw new ORPCError("BAD_GATEWAY", { message: "Could not reach the AI provider.", cause });
}

function throwAiProviderConfigError(): never {
	throw new ORPCError("BAD_REQUEST", { message: "Invalid AI provider configuration." });
}

function throwCredentialEncryptionUnavailable(): never {
	throw new ORPCError("PRECONDITION_FAILED", {
		message: "AI providers are unavailable because ENCRYPTION_SECRET is not configured.",
	});
}

function throwResumeStructureError(error: ZodError): never {
	throw new ORPCError("BAD_REQUEST", {
		message: "Invalid resume data structure",
		cause: flattenError(error),
	});
}

async function getRunnableProvider(aiProviderId?: string) {
	const provider = aiProviderId
		? await aiProvidersService.getRunnableById({ id: aiProviderId })
		: await aiProvidersService.getDefaultRunnable();

	if (!provider) throw new ORPCError("BAD_REQUEST", { message: "No tested AI provider is available." });

	return provider;
}

export const aiRouter = {
	parsePdf: protectedProcedure
		.route({
			method: "POST",
			path: "/ai/parse-pdf",
			tags: ["AI"],
			operationId: "parseResumePdf",
			summary: "Parse a PDF file into resume data",
			description:
				"Extracts structured resume data from a PDF file using the specified AI provider. The file should be sent as a base64-encoded string along with AI provider credentials. Returns a complete ResumeData object. Requires authentication.",
			successDescription: "The PDF was successfully parsed into structured resume data.",
		})
		.input(z.object({ aiProviderId: z.string().optional(), file: fileInputSchema }))
		.use(aiRequestRateLimit)
		.errors({
			BAD_GATEWAY: { message: "The AI provider returned an error or is unreachable.", status: 502 },
			BAD_REQUEST: { message: "The AI returned an improperly formatted structure.", status: 400 },
		})
		.handler(async ({ input }): Promise<ResumeData> => {
			try {
				const provider = await getRunnableProvider(input.aiProviderId);
				return await aiService.parsePdf({
					provider: provider.provider,
					model: provider.model,
					apiKey: provider.apiKey,
					baseURL: provider.baseURL ?? "",
					file: input.file,
				});
			} catch (error) {
				if (isCredentialEncryptionUnavailable(error)) throwCredentialEncryptionUnavailable();
				if (isInvalidAiBaseUrlError(error)) throwAiProviderConfigError();
				if (isAiProviderGatewayError(error)) throwAiProviderGatewayError(error);
				if (error instanceof ZodError) throwResumeStructureError(error);
				throw error;
			}
		}),

	parseDocx: protectedProcedure
		.route({
			method: "POST",
			path: "/ai/parse-docx",
			tags: ["AI"],
			operationId: "parseResumeDocx",
			summary: "Parse a DOCX file into resume data",
			description:
				"Extracts structured resume data from a DOCX or DOC file using the specified AI provider. The file should be sent as a base64-encoded string along with AI provider credentials and the document's media type. Returns a complete ResumeData object. Requires authentication.",
			successDescription: "The DOCX was successfully parsed into structured resume data.",
		})
		.input(
			z.object({
				aiProviderId: z.string().optional(),
				file: fileInputSchema,
				mediaType: z.enum([
					"application/msword",
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				]),
			}),
		)
		.use(aiRequestRateLimit)
		.errors({
			BAD_GATEWAY: { message: "The AI provider returned an error or is unreachable.", status: 502 },
			BAD_REQUEST: { message: "The AI returned an improperly formatted structure.", status: 400 },
		})
		.handler(async ({ input }) => {
			try {
				const provider = await getRunnableProvider(input.aiProviderId);
				return await aiService.parseDocx({
					provider: provider.provider,
					model: provider.model,
					apiKey: provider.apiKey,
					baseURL: provider.baseURL ?? "",
					mediaType: input.mediaType,
					file: input.file,
				});
			} catch (error) {
				if (isCredentialEncryptionUnavailable(error)) throwCredentialEncryptionUnavailable();
				if (isInvalidAiBaseUrlError(error)) throwAiProviderConfigError();
				if (isAiProviderGatewayError(error)) throwAiProviderGatewayError(error);
				if (error instanceof ZodError) throwResumeStructureError(error);
				throw error;
			}
		}),

	chat: protectedProcedure
		.route({
			method: "POST",
			path: "/ai/chat",
			tags: ["AI"],
			operationId: "aiChat",
			summary: "Chat with AI to modify resume",
			description:
				"Streams a chat response from the configured AI provider. The LLM can call the propose_resume_patches tool to generate JSON Patch proposals for explicit user approval. Requires authentication and AI provider credentials.",
		})
		.input(
			type<{
				aiProviderId?: string;
				messages: UIMessage[];
				resumeId: string;
			}>(),
		)
		.use(aiRequestRateLimit)
		.handler(async ({ context, input }) => {
			try {
				const [provider, resume] = await Promise.all([
					getRunnableProvider(input.aiProviderId),
					resumeService.getById({ id: input.resumeId, userId: context.user.id }),
				]);

				return await aiService.chat({
					provider: provider.provider,
					model: provider.model,
					apiKey: provider.apiKey,
					baseURL: provider.baseURL ?? "",
					messages: input.messages,
					resumeData: resume.data,
					resumeUpdatedAt: resume.updatedAt,
				});
			} catch (error) {
				if (isCredentialEncryptionUnavailable(error)) throwCredentialEncryptionUnavailable();
				if (isInvalidAiBaseUrlError(error)) throwAiProviderConfigError();
				if (isAiProviderGatewayError(error)) throwAiProviderGatewayError(error);
				throw error;
			}
		}),

	analyzeResume: protectedProcedure
		.route({
			method: "POST",
			path: "/ai/analyze-resume",
			tags: ["AI"],
			operationId: "analyzeResume",
			summary: "Analyze resume and persist latest analysis",
			description:
				"Uses AI to analyze the current resume and returns a structured analysis with scorecard, strengths, and improvement suggestions. The latest analysis is persisted and can be fetched later. Requires authentication and AI credentials.",
			successDescription: "Structured resume analysis returned and persisted successfully.",
		})
		.input(
			z.object({
				aiProviderId: z.string().optional(),
				resumeId: z.string(),
				locale: z.string().optional(),
			}),
		)
		.use(aiRequestRateLimit)
		.output(storedResumeAnalysisSchema)
		.errors({
			BAD_GATEWAY: { message: "The AI provider returned an error or is unreachable.", status: 502 },
			BAD_REQUEST: { message: "The AI returned an improperly formatted structure.", status: 400 },
			PRECONDITION_FAILED: { message: "You have exceeded your resume analysis quota.", status: 429 },
		})
		.handler(async ({ context, input }) => {
			try {
				await checkResumeAnalysisQuota(context.user.id);

				const [provider, resume] = await Promise.all([
					getRunnableProvider(input.aiProviderId),
					resumeService.getById({ id: input.resumeId, userId: context.user.id }),
				]);
				const analysis = await aiService.analyzeResume({
					provider: provider.provider,
					model: provider.model,
					apiKey: provider.apiKey,
					baseURL: provider.baseURL ?? "",
					resumeData: resume.data,
					...(input.locale ? { locale: input.locale } : {}),
				});

				await consumeResumeAnalysisQuota(context.user.id);

				return await resumeService.analysis.upsert({
					id: input.resumeId,
					userId: context.user.id,
					analysis: {
						...analysis,
						updatedAt: new Date(),
						modelMeta: { provider: provider.provider, model: provider.model },
					},
				});
			} catch (error) {
				if (isCredentialEncryptionUnavailable(error)) throwCredentialEncryptionUnavailable();
				if (isInvalidAiBaseUrlError(error)) throwAiProviderConfigError();
				if (isAiProviderGatewayError(error)) throwAiProviderGatewayError(error);
				if (error instanceof ZodError) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Invalid resume analysis structure",
						cause: flattenError(error),
					});
				}
				throw error;
			}
		}),

	analyzeResumeStream: protectedProcedure
		.route({
			method: "POST",
			path: "/ai/analyze-resume-stream",
			tags: ["AI"],
			operationId: "analyzeResumeStream",
			summary: "Stream a resume analysis",
			description:
				"Streams a resume analysis with an overall score, scorecard, strengths, and suggestions. Emits raw text chunks as the AI generates the report, then a complete event carrying the persisted structured analysis. Requires authentication and AI credentials.",
		})
		.input(
			z.object({
				aiProviderId: z.string().optional(),
				resumeId: z.string(),
				locale: z.string().optional(),
			}),
		)
		.use(aiRequestRateLimit)
		.errors({
			BAD_GATEWAY: { message: "The AI provider returned an error or is unreachable.", status: 502 },
			BAD_REQUEST: { message: "The AI returned an improperly formatted structure.", status: 400 },
			PRECONDITION_FAILED: { message: "You have exceeded your resume analysis quota.", status: 429 },
		})
		.handler(async ({ context, input }) => {
			await checkResumeAnalysisQuota(context.user.id);

			const [provider, resume] = await Promise.all([
				getRunnableProvider(input.aiProviderId),
				resumeService.getById({ id: input.resumeId, userId: context.user.id }),
			]);

			return streamToEventIterator(
				eventIteratorToStream(
					(async function* streamResumeAnalysis(): AsyncGenerator<ResumeAnalysisStreamEvent, void, unknown> {
						try {
							for await (const event of aiService.analyzeResumeStream({
								provider: provider.provider,
								model: provider.model,
								apiKey: provider.apiKey,
								baseURL: provider.baseURL ?? "",
								resumeData: resume.data,
								...(input.locale ? { locale: input.locale } : {}),
							})) {
								if (event.type === "complete") {
									await consumeResumeAnalysisQuota(context.user.id);

									const saved = await resumeService.analysis.upsert({
										id: input.resumeId,
										userId: context.user.id,
										analysis: {
											...event.analysis,
											updatedAt: new Date(),
											modelMeta: { provider: provider.provider, model: provider.model },
										},
									});

									yield { type: "complete", analysis: saved };
								} else {
									yield event;
								}
							}
						} catch (error) {
							if (isCredentialEncryptionUnavailable(error)) {
								yield {
									type: "error",
									code: "PRECONDITION_FAILED",
									message: "AI providers are unavailable because ENCRYPTION_SECRET is not configured.",
								};
							} else if (isInvalidAiBaseUrlError(error)) {
								yield { type: "error", code: "BAD_REQUEST", message: "Invalid AI provider configuration." };
							} else if (isAiProviderGatewayError(error)) {
								yield { type: "error", code: "BAD_GATEWAY", message: "Could not reach the AI provider." };
							} else if (error instanceof ZodError) {
								yield { type: "error", code: "BAD_REQUEST", message: "Invalid resume analysis structure" };
							} else {
								yield {
									type: "error",
									code: "INTERNAL_SERVER_ERROR",
									message: error instanceof Error ? error.message : "Unknown error.",
								};
							}
						}
					})(),
				),
			);
		}),

	analyzeJobMatch: protectedProcedure
		.route({
			method: "POST",
			path: "/ai/analyze-job-match",
			tags: ["AI"],
			operationId: "analyzeJobMatch",
			summary: "Analyze a job description against the resume",
			description:
				"Uses AI to compare a pasted job description against the current resume and returns a structured job-match analysis with a six-dimension scorecard, keyword coverage, gaps, and prioritized rewrite suggestions. Each analysis is persisted so the user can review history. Requires authentication and AI credentials.",
			successDescription: "Structured job-match analysis returned and persisted successfully.",
		})
		.input(
			z.object({
				aiProviderId: z.string().optional(),
				resumeId: z.string(),
				jobDescription: z.string().min(1).max(20000),
				locale: z.string().optional(),
			}),
		)
		.use(aiRequestRateLimit)
		.output(
			z.object({
				id: z.string(),
				analysis: storedJobMatchAnalysisSchema,
				createdAt: z.coerce.date(),
			}),
		)
		.errors({
			BAD_GATEWAY: { message: "The AI provider returned an error or is unreachable.", status: 502 },
			BAD_REQUEST: { message: "The AI returned an improperly formatted structure.", status: 400 },
			PRECONDITION_FAILED: { message: "You have exceeded your resume analysis quota.", status: 429 },
		})
		.handler(async ({ context, input }) => {
			try {
				await checkResumeAnalysisQuota(context.user.id);

				const [provider, resume] = await Promise.all([
					getRunnableProvider(input.aiProviderId),
					resumeService.getById({ id: input.resumeId, userId: context.user.id }),
				]);
				const analysis = await aiService.analyzeJobMatch({
					provider: provider.provider,
					model: provider.model,
					apiKey: provider.apiKey,
					baseURL: provider.baseURL ?? "",
					jobDescription: input.jobDescription,
					resumeData: resume.data,
					...(input.locale ? { locale: input.locale } : {}),
				});

				await consumeResumeAnalysisQuota(context.user.id);

				return await resumeService.jobAnalysis.create({
					resumeId: input.resumeId,
					userId: context.user.id,
					analysis: {
						...analysis,
						jdText: input.jobDescription,
						updatedAt: new Date(),
						modelMeta: { provider: provider.provider, model: provider.model },
					},
				});
			} catch (error) {
				if (isCredentialEncryptionUnavailable(error)) throwCredentialEncryptionUnavailable();
				if (isInvalidAiBaseUrlError(error)) throwAiProviderConfigError();
				if (isAiProviderGatewayError(error)) throwAiProviderGatewayError(error);
				if (error instanceof ZodError) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Invalid job-match analysis structure",
						cause: flattenError(error),
					});
				}
				throw error;
			}
		}),

	analyzeJobMatchStream: protectedProcedure
		.route({
			method: "POST",
			path: "/ai/analyze-job-match-stream",
			tags: ["AI"],
			operationId: "analyzeJobMatchStream",
			summary: "Stream a job description match analysis against the resume",
			description:
				"Streams a job-match analysis comparing a pasted job description against the current resume. Emits raw text chunks as the AI generates the report, then a complete event carrying the persisted structured analysis. Requires authentication and AI credentials.",
		})
		.input(
			z.object({
				aiProviderId: z.string().optional(),
				resumeId: z.string(),
				jobDescription: z.string().min(1).max(20000),
				locale: z.string().optional(),
			}),
		)
		.use(aiRequestRateLimit)
		.errors({
			BAD_GATEWAY: { message: "The AI provider returned an error or is unreachable.", status: 502 },
			BAD_REQUEST: { message: "The AI returned an improperly formatted structure.", status: 400 },
			PRECONDITION_FAILED: { message: "You have exceeded your resume analysis quota.", status: 429 },
		})
		.handler(async ({ context, input }) => {
			await checkResumeAnalysisQuota(context.user.id);

			const [provider, resume] = await Promise.all([
				getRunnableProvider(input.aiProviderId),
				resumeService.getById({ id: input.resumeId, userId: context.user.id }),
			]);

			return streamToEventIterator(
				eventIteratorToStream(
					(async function* streamJobMatchAnalysis(): AsyncGenerator<JobMatchStreamEvent, void, unknown> {
						try {
							for await (const event of aiService.analyzeJobMatchStream({
								provider: provider.provider,
								model: provider.model,
								apiKey: provider.apiKey,
								baseURL: provider.baseURL ?? "",
								jobDescription: input.jobDescription,
								resumeData: resume.data,
								...(input.locale ? { locale: input.locale } : {}),
							})) {
								if (event.type === "complete") {
									await consumeResumeAnalysisQuota(context.user.id);

									const saved = await resumeService.jobAnalysis.create({
										resumeId: input.resumeId,
										userId: context.user.id,
										analysis: {
											...event.analysis,
											jdText: input.jobDescription,
											updatedAt: new Date(),
											modelMeta: { provider: provider.provider, model: provider.model },
										},
									});

									yield {
										type: "complete",
										id: saved.id,
										analysis: saved.analysis,
										createdAt: saved.createdAt.toISOString(),
									};
								} else {
									yield event;
								}
							}
						} catch (error) {
							if (isCredentialEncryptionUnavailable(error)) {
								yield {
									type: "error",
									code: "PRECONDITION_FAILED",
									message: "AI providers are unavailable because ENCRYPTION_SECRET is not configured.",
								};
							} else if (isInvalidAiBaseUrlError(error)) {
								yield { type: "error", code: "BAD_REQUEST", message: "Invalid AI provider configuration." };
							} else if (isAiProviderGatewayError(error)) {
								yield { type: "error", code: "BAD_GATEWAY", message: "Could not reach the AI provider." };
							} else if (error instanceof ZodError) {
								yield { type: "error", code: "BAD_REQUEST", message: "Invalid job-match analysis structure" };
							} else {
								yield {
									type: "error",
									code: "INTERNAL_SERVER_ERROR",
									message: error instanceof Error ? error.message : "Unknown error.",
								};
							}
						}
					})(),
				),
			);
		}),

	listJobAnalysis: protectedProcedure
		.route({
			method: "GET",
			path: "/ai/job-analysis/{resumeId}",
			tags: ["AI"],
			operationId: "listJobAnalysis",
			summary: "List persisted job-match analyses for a resume",
			description:
				"Returns the most recent job-match analyses for the given resume, newest first. Each entry includes the stored analysis and its creation date. Requires authentication.",
			successDescription: "Job-match analysis history returned successfully.",
		})
		.input(
			z.object({
				resumeId: z.string(),
			}),
		)
		.errors({
			BAD_REQUEST: { message: "Invalid resume id.", status: 400 },
		})
		.handler(async ({ context, input }) => {
			return await resumeService.jobAnalysis.listByResumeId({
				resumeId: input.resumeId,
				userId: context.user.id,
			});
		}),
};
