import { z } from "zod";
import { protectedProcedure } from "../../context";
import { submitFeedbackSchema } from "./schema";
import { listMyFeedback, submitFeedback } from "./service";

export const feedbackRouter = {
	submit: protectedProcedure
		.route({
			method: "POST",
			path: "/feedback",
			tags: ["Feedback"],
			operationId: "submitFeedback",
			summary: "Submit feedback",
			description:
				"Submits user feedback with rich text content and optional image URLs. Requires a signed-in session.",
			successDescription: "The feedback was created.",
		})
		.input(submitFeedbackSchema)
		.output(z.object({ ok: z.literal(true), feedbackId: z.string() }))
		.handler(({ context, input }) => submitFeedback(context.user.id, input)),

	listMine: protectedProcedure
		.route({
			method: "GET",
			path: "/feedback/mine",
			tags: ["Feedback"],
			operationId: "listMyFeedback",
			summary: "List my feedback",
			description: "Lists the feedback submitted by the signed-in user, most recent first.",
			successDescription: "Paginated feedback list.",
		})
		.input(
			z.object({
				page: z.number().int().min(1).default(1),
				limit: z.number().int().min(1).max(100).default(20),
			}),
		)
		.output(
			z.object({
				items: z.array(
					z.object({
						id: z.string(),
						userId: z.string(),
						content: z.string(),
						images: z.array(z.string()),
						status: z.string(),
						createdAt: z.date(),
						updatedAt: z.date(),
					}),
				),
				total: z.number().int(),
				page: z.number().int(),
				limit: z.number().int(),
			}),
		)
		.handler(({ context, input }) => listMyFeedback(context.user.id, input.page, input.limit)),
};
