import { ORPCError } from "@orpc/server";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import { user, userQuota, userTransaction } from "@reactive-resume/db/schema";

/** 使用明细类型，与配额种类一一对应。 */
export type TransactionType = "threadMessages" | "resumeAnalyses" | "resumeDownloads";

/**
 * 各类使用扣费金额（单位：分）。
 * 每 ¥1 获得 1 次下载；每 ¥2 获得 1 次简历分析；每 ¥2 获得 1 次对话生成。
 */
export const PRICE_PER_USE_CENTS: Record<TransactionType, number> = {
	resumeDownloads: 100,
	resumeAnalyses: 200,
	threadMessages: 200,
};

const TYPE_REMARKS: Record<TransactionType, string> = {
	threadMessages: "简历生成对话",
	resumeAnalyses: "简历分析",
	resumeDownloads: "附件下载",
};

export type UserTransactionItem = typeof userTransaction.$inferSelect;

/**
 * 从用户余额中扣除一次使用费用，并记录一条使用明细。
 * 当前为「尽力扣费」：不因余额不足而阻断功能（余额可为负），
 * 待充值功能上线后再接入强校验。
 */
export async function deductBalance(userId: string, type: TransactionType): Promise<void> {
	const priceCents = PRICE_PER_USE_CENTS[type];

	await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(user)
			.set({ balance: sql`${user.balance} - ${priceCents}` })
			.where(eq(user.id, userId))
			.returning({ balance: user.balance });

		if (!updated) return;

		await tx.insert(userTransaction).values({
			userId,
			type,
			amount: -priceCents,
			balance: updated.balance,
			remark: TYPE_REMARKS[type],
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
