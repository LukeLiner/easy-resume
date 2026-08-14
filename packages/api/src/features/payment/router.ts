import { z } from "zod";
import { protectedProcedure } from "../../context";
import { listMyOrders, submitRecharge } from "./service";
import { getPaymentConfig, MIN_RECHARGE_CENTS } from "./wechat-pay";

const paymentOrderSchema = z.object({
	id: z.string(),
	userId: z.string(),
	orderNo: z.string(),
	amount: z.number().int(),
	status: z.string(),
	codeUrl: z.string().nullable(),
	transactionId: z.string().nullable(),
	paidAt: z.date().nullable(),
	proofUrl: z.string().nullable(),
	contactEmail: z.string().nullable(),
	paidAmount: z.number().int().nullable(),
	expiresAt: z.date(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export const paymentRouter = {
	getConfig: protectedProcedure
		.route({
			method: "GET",
			path: "/payment/config",
			tags: ["Payment"],
			operationId: "getPaymentConfig",
			summary: "Get the manual recharge configuration",
		})
		.output(
			z.object({
				enabled: z.boolean(),
				qrCodeUrl: z.string().nullable(),
				minRechargeCents: z.number().int(),
			}),
		)
		.handler(async () => getPaymentConfig()),

	submitRecharge: protectedProcedure
		.route({
			method: "POST",
			path: "/payment/recharge",
			tags: ["Payment"],
			operationId: "submitRecharge",
			summary: "Submit a manual recharge request with payment proof",
		})
		.input(
			z.object({
				amount: z.number().int().min(MIN_RECHARGE_CENTS),
				proofUrl: z.string().min(1),
				contactEmail: z.string().email().optional(),
			}),
		)
		.output(
			z.object({
				orderNo: z.string(),
				status: z.string(),
			}),
		)
		.handler(async ({ context, input }) => submitRecharge(context.user.id, input)),

	listMyOrders: protectedProcedure
		.route({
			method: "GET",
			path: "/payment/orders",
			tags: ["Payment"],
			operationId: "listMyPaymentOrders",
			summary: "List the current user's recharge requests",
		})
		.input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().int().min(1).max(100).default(20) }))
		.output(z.object({ orders: z.array(paymentOrderSchema), total: z.number().int() }))
		.handler(async ({ context, input }) => listMyOrders(context.user.id, input.page, input.limit)),
};
