import { randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import { paymentExceptionLog, paymentOrder, user, userTransaction } from "@reactive-resume/db/schema";
import { getPaymentConfig, MIN_RECHARGE_CENTS, triggerN8nWebhook } from "./wechat-pay";

function generateOrderNo(): string {
	return `R${Date.now()}${randomBytes(4).toString("hex")}`;
}

/** 脱敏：移除 PEM 私钥块与常见密钥字段，避免敏感信息入库。 */
function desensitize(value: string): string {
	return value
		.replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[REDACTED-PEM]")
		.replace(/("?(?:apiV3Key|api_v3_key|private_key|secret|key)"?\s*:\s*")[^"]*(")/g, "$1[REDACTED]$3");
}

type RecordExceptionInput = {
	orderNo?: string | undefined;
	userId?: string | undefined;
	stage: string;
	errorType: string;
	message: string;
	rawPayload?: string | undefined;
	stack?: string | undefined;
};

/** 记录支付异常日志（静默失败不影响主流程）。 */
export async function recordException(input: RecordExceptionInput): Promise<void> {
	try {
		await db.insert(paymentExceptionLog).values({
			orderNo: input.orderNo ?? null,
			userId: input.userId ?? null,
			stage: input.stage,
			errorType: input.errorType,
			message: input.message.slice(0, 2000),
			rawPayload: input.rawPayload ? desensitize(input.rawPayload).slice(0, 4000) : null,
			stack: input.stack?.slice(0, 4000) ?? null,
		});
	} catch (error) {
		console.error("Failed to record payment exception:", error);
	}
}

export type SubmitRechargeInput = {
	amount: number;
	proofUrl: string;
	contactEmail?: string | undefined;
};

export type SubmitRechargeResult = {
	orderNo: string;
	status: string;
};

/** 提交充值申请：校验金额 → 创建人工审核订单 → 触发 N8N webhook（预留）。 */
export async function submitRecharge(userId: string, input: SubmitRechargeInput): Promise<SubmitRechargeResult> {
	const { enabled } = getPaymentConfig();
	if (!enabled) {
		throw new ORPCError("FORBIDDEN", { message: "Recharge is not enabled." });
	}

	if (!Number.isInteger(input.amount) || input.amount < MIN_RECHARGE_CENTS || input.amount % MIN_RECHARGE_CENTS !== 0) {
		throw new ORPCError("BAD_REQUEST", { message: "Amount must be a multiple of 10 CNY (1000 cents)." });
	}

	const orderNo = generateOrderNo();
	// 人工审核没有支付超时概念，仅占位一个较长有效期，审核通过前不会自动入账。
	const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

	await db.insert(paymentOrder).values({
		userId,
		orderNo,
		amount: input.amount,
		status: "manual_review",
		proofUrl: input.proofUrl,
		contactEmail: input.contactEmail ?? null,
		paidAmount: input.amount,
		expiresAt,
	});

	await triggerN8nWebhook({
		orderNo,
		userId,
		amount: input.amount,
		contactEmail: input.contactEmail,
		proofUrl: input.proofUrl,
	});

	return { orderNo, status: "manual_review" };
}

export async function listMyOrders(userId: string, page: number, limit: number) {
	const where = eq(paymentOrder.userId, userId);

	const [orders, [totalRow]] = await Promise.all([
		db
			.select()
			.from(paymentOrder)
			.where(where)
			.orderBy(desc(paymentOrder.createdAt))
			.limit(limit)
			.offset((page - 1) * limit),
		db.select({ total: count() }).from(paymentOrder).where(where),
	]);

	return { orders, total: totalRow?.total ?? 0 };
}

export type AdminPaymentFilters = {
	page: number;
	limit: number;
	status?: string | undefined;
	userId?: string | undefined;
};

export async function listPayments(input: AdminPaymentFilters) {
	const conditions = [
		input.status ? eq(paymentOrder.status, input.status) : undefined,
		input.userId ? eq(paymentOrder.userId, input.userId) : undefined,
	].filter((condition): condition is ReturnType<typeof eq> => Boolean(condition));
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [orders, [totalRow]] = await Promise.all([
		db
			.select({
				id: paymentOrder.id,
				userId: paymentOrder.userId,
				orderNo: paymentOrder.orderNo,
				amount: paymentOrder.amount,
				status: paymentOrder.status,
				codeUrl: paymentOrder.codeUrl,
				transactionId: paymentOrder.transactionId,
				paidAt: paymentOrder.paidAt,
				proofUrl: paymentOrder.proofUrl,
				contactEmail: paymentOrder.contactEmail,
				paidAmount: paymentOrder.paidAmount,
				expiresAt: paymentOrder.expiresAt,
				createdAt: paymentOrder.createdAt,
				updatedAt: paymentOrder.updatedAt,
				username: user.username,
				email: user.email,
			})
			.from(paymentOrder)
			.leftJoin(user, eq(paymentOrder.userId, user.id))
			.where(where)
			.orderBy(desc(paymentOrder.createdAt))
			.limit(input.limit)
			.offset((input.page - 1) * input.limit),
		db.select({ total: count() }).from(paymentOrder).where(where),
	]);

	return { orders, total: totalRow?.total ?? 0 };
}

export async function listExceptions(page: number, limit: number) {
	const [logs, [totalRow]] = await Promise.all([
		db
			.select()
			.from(paymentExceptionLog)
			.orderBy(desc(paymentExceptionLog.createdAt))
			.limit(limit)
			.offset((page - 1) * limit),
		db.select({ total: count() }).from(paymentExceptionLog),
	]);

	return { logs, total: totalRow?.total ?? 0 };
}

export type ReviewDecision = "approve" | "reject";

/** 管理员审核充值申请：approve 入账并写流水，reject 拒绝。 */
export async function reviewPayment(orderId: string, decision: ReviewDecision): Promise<void> {
	await db.transaction(async (tx) => {
		const [order] = await tx.select().from(paymentOrder).where(eq(paymentOrder.id, orderId)).limit(1);
		if (!order) throw new ORPCError("NOT_FOUND", { message: "Order not found" });
		if (order.status !== "manual_review") {
			throw new ORPCError("CONFLICT", { message: "Order is not pending review." });
		}

		if (decision === "reject") {
			await tx.update(paymentOrder).set({ status: "rejected" }).where(eq(paymentOrder.id, orderId));
			return;
		}

		const amount = order.paidAmount ?? order.amount;

		const [updatedUser] = await tx
			.update(user)
			.set({ balance: sql`${user.balance} + ${amount}` })
			.where(eq(user.id, order.userId))
			.returning({ balance: user.balance });

		if (!updatedUser) throw new ORPCError("NOT_FOUND", { message: "User not found" });

		await tx.insert(userTransaction).values({
			userId: order.userId,
			type: "recharge",
			amount,
			balance: updatedUser.balance,
			remark: "手动充值审核通过",
		});

		await tx
			.update(paymentOrder)
			.set({ status: "paid", paidAt: new Date(), paidAmount: amount })
			.where(eq(paymentOrder.id, orderId));
	});
}
