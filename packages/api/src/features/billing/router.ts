import { z } from "zod";
import { protectedProcedure } from "../../context";
import { getBillingPrices, getUserCenter, listTransactions } from "./service";

export const billingRouter = {
	getUserCenter: protectedProcedure
		.route({
			method: "GET",
			path: "/billing/user-center",
			tags: ["Billing"],
			operationId: "getUserCenter",
			summary: "Get the current user's account info, status and balance",
		})
		.output(
			z.object({
				username: z.string(),
				email: z.string(),
				status: z.string(),
				balance: z.number(),
				quota: z.object({
					threadMessagesLimit: z.number().int(),
					threadMessagesUsed: z.number().int(),
					resumeAnalysesLimit: z.number().int(),
					resumeAnalysesUsed: z.number().int(),
					resumeDownloadsLimit: z.number().int(),
					resumeDownloadsUsed: z.number().int(),
				}),
			}),
		)
		.handler(async ({ context }) => getUserCenter(context.user.id)),

	listTransactions: protectedProcedure
		.route({
			method: "GET",
			path: "/billing/transactions",
			tags: ["Billing"],
			operationId: "listBillingTransactions",
			summary: "List the current user's billing transactions",
		})
		.input(
			z.object({
				page: z.number().int().min(1).default(1),
				limit: z.number().int().min(1).max(100).default(20),
			}),
		)
		.output(
			z.object({
				transactions: z.array(
					z.object({
						id: z.string(),
						type: z.string(),
						amount: z.number(),
						balance: z.number(),
						tokens: z.number().nullable(),
						remark: z.string().nullable(),
						createdAt: z.date(),
					}),
				),
				total: z.number(),
			}),
		)
		.handler(async ({ context, input }) => listTransactions(context.user.id, input.page, input.limit)),

	getPrices: protectedProcedure
		.route({
			method: "GET",
			path: "/billing/prices",
			tags: ["Billing"],
			operationId: "getBillingPrices",
			summary: "Get the current billing prices (in cents)",
		})
		.output(
			z.object({
				pricePerDownloadCents: z.number().int(),
				pricePerAnalysisCents: z.number().int(),
				pricePerMillionTokensCents: z.number().int(),
			}),
		)
		.handler(async () => getBillingPrices()),
};
