import { ORPCError } from "@orpc/server";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import { user, userQuota, userTransaction } from "@reactive-resume/db/schema";

/** 使用明细类型，与配额种类一一对应。 */
export type TransactionType = "threadMessages" | "resumeAnalyses" | "resumeDownloads";

/**
 * 各类使用扣费金额（单位：分）。
 * 每 ¥1 获得 1 次下载；每 ¥2 获得 1 次简历分析。
 * 注：对话生成（threadMessages）已改为按实际 token 用量计费，
 * 见 `PRICE_PER_MILLION_TOKENS_CENTS` 与 `deductBalanceByTokens`，不再使用此处的固定单价。
 */
export const PRICE_PER_USE_CENTS: Record<TransactionType, number> = {
	resumeDownloads: 100,
	resumeAnalyses: 200,
	threadMessages: 200,
};

/**
 * 对话生成按 token 计费的单价：6 元 / 百万 token（= 600 分）。
 * 即每 1 token 消耗 0.0006 分，最终金额向上取整到「分」，最低 1 分。
 */
export const PRICE_PER_MILLION_TOKENS_CENTS = 600;

const TYPE_REMARKS: Record<TransactionType, string> = {
	threadMessages: "简历生成对话",
	resumeAnalyses: "简历分析",
	resumeDownloads: "附件下载",
};

export type UserTransactionItem = typeof userTransaction.$inferSelect;

/**
 * 校验用户余额是否足够支付一次 `type` 的使用费用。
 * 余额不足时抛出 PRECONDITION_FAILED，供预检查（checkDownload 等）在操作前拦截，
 * 避免先生成文件/分析再因余额不足而失败。
 */
export async function assertSufficientBalance(userId: string, type: TransactionType): Promise<void> {
	const priceCents = PRICE_PER_USE_CENTS[type];

	const [row] = await db
		.select({ balance: user.balance })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!row) throw new ORPCError("NOT_FOUND", { message: "User not found" });
	if (row.balance < priceCents) {
		throw new ORPCError("PRECONDITION_FAILED", { message: "额度不足，请充值" });
	}
}

/**
 * 从用户余额中扣除一次使用费用，并记录一条使用明细。
 * 原子扣减：余额不足时更新不生效并抛出 PRECONDITION_FAILED，余额不会变为负数。
 */
export async function deductBalance(userId: string, type: TransactionType): Promise<void> {
	const priceCents = PRICE_PER_USE_CENTS[type];

	await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(user)
			.set({ balance: sql`${user.balance} - ${priceCents}` })
			.where(and(eq(user.id, userId), gte(user.balance, priceCents)))
			.returning({ balance: user.balance });

		if (!updated) {
			throw new ORPCError("PRECONDITION_FAILED", { message: "额度不足，请充值" });
		}

		await tx.insert(userTransaction).values({
			userId,
			type,
			amount: -priceCents,
			balance: updated.balance,
			remark: TYPE_REMARKS[type],
		});
	});
}

/**
 * 将 token 数换算为应付金额（分），按 `PRICE_PER_MILLION_TOKENS_CENTS` 计费，
 * 向上取整到「分」且最低 1 分，避免极短消息产生 0 元扣费。
 */
export function tokensToCents(tokens: number): number {
	return Math.max(1, Math.ceil((tokens * PRICE_PER_MILLION_TOKENS_CENTS) / 1_000_000));
}

/**
 * 校验用户余额为正，供按 token 计费的操作在生成前做预检。
 * 与 `assertSufficientBalance` 不同，此处不比对具体金额，仅要求余额 > 0；
 * 实际扣费在生成完成后依据真实 token 用量结算。
 */
export async function assertPositiveBalance(userId: string): Promise<void> {
	const [row] = await db
		.select({ balance: user.balance })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!row) throw new ORPCError("NOT_FOUND", { message: "User not found" });
	if (row.balance <= 0) {
		throw new ORPCError("PRECONDITION_FAILED", { message: "额度不足，请充值" });
	}
}

/**
 * 按实际 token 用量扣费并记录一条含 token 数目的使用明细。
 * 后付费语义：费用已真实发生，故不阻止余额变为负数（欠费）。
 */
export async function deductBalanceByTokens(userId: string, tokens: number): Promise<void> {
	const priceCents = tokensToCents(tokens);

	await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(user)
			.set({ balance: sql`${user.balance} - ${priceCents}` })
			.where(eq(user.id, userId))
			.returning({ balance: user.balance });

		if (!updated) throw new ORPCError("NOT_FOUND", { message: "User not found" });

		await tx.insert(userTransaction).values({
			userId,
			type: "threadMessages",
			amount: -priceCents,
			balance: updated.balance,
			tokens,
			remark: TYPE_REMARKS.threadMessages,
		});
	});
}

export type QuotaProfile = {
	threadMessagesLimit: number;
	threadMessagesUsed: number;
	resumeAnalysesLimit: number;
	resumeAnalysesUsed: number;
	resumeDownloadsLimit: number;
	resumeDownloadsUsed: number;
};

export type UserCenterProfile = {
	username: string;
	email: string;
	status: string;
	balance: number;
	quota: QuotaProfile;
};

export async function getUserCenter(userId: string): Promise<UserCenterProfile> {
	const [record] = await db
		.select({
			username: user.username,
			email: user.email,
			status: user.status,
			balance: user.balance,
			threadMessagesLimit: userQuota.threadMessagesLimit,
			threadMessagesUsed: userQuota.threadMessagesUsed,
			resumeAnalysesLimit: userQuota.resumeAnalysesLimit,
			resumeAnalysesUsed: userQuota.resumeAnalysesUsed,
			resumeDownloadsLimit: userQuota.resumeDownloadsLimit,
			resumeDownloadsUsed: userQuota.resumeDownloadsUsed,
		})
		.from(user)
		.leftJoin(userQuota, eq(user.id, userQuota.userId))
		.where(eq(user.id, userId))
		.limit(1);

	if (!record) throw new ORPCError("NOT_FOUND", { message: "User not found" });

	const { username, email, status, balance, ...quota } = record;

	return {
		username,
		email,
		status,
		balance,
		quota: {
			threadMessagesLimit: quota.threadMessagesLimit ?? -1,
			threadMessagesUsed: quota.threadMessagesUsed ?? 0,
			resumeAnalysesLimit: quota.resumeAnalysesLimit ?? -1,
			resumeAnalysesUsed: quota.resumeAnalysesUsed ?? 0,
			resumeDownloadsLimit: quota.resumeDownloadsLimit ?? -1,
			resumeDownloadsUsed: quota.resumeDownloadsUsed ?? 0,
		},
	};
}

export type TransactionList = {
	transactions: UserTransactionItem[];
	total: number;
};

export async function listTransactions(userId: string, page: number, limit: number): Promise<TransactionList> {
	const where = eq(userTransaction.userId, userId);

	const [transactions, [totalRow]] = await Promise.all([
		db
			.select()
			.from(userTransaction)
			.where(where)
			.orderBy(desc(userTransaction.createdAt))
			.limit(limit)
			.offset((page - 1) * limit),
		db.select({ total: count() }).from(userTransaction).where(where),
	]);

	return { transactions, total: totalRow?.total ?? 0 };
}
