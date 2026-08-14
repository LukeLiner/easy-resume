import { z } from "zod";
import { protectedProcedure } from "../../context";
import { getUserCenter, listTransactions } from "./service";

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
						remark: z.string().nullable(),
						createdAt: z.date(),
					}),
				),
				total: z.number(),
			}),
		)
		.handler(async ({ context, input }) => listTransactions(context.user.id, input.page, input.limit)),
};
