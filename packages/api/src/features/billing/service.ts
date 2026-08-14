import { ORPCError } from "@orpc/server";
import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import { user, userTransaction } from "@reactive-resume/db/schema";

/** 每次使用扣费金额（单位：分）。0.5 元 = 50 分。 */
export const PRICE_PER_USE_CENTS = 50;

/** 使用明细类型，与配额种类一一对应。 */
export type TransactionType = "threadMessages" | "resumeAnalyses" | "resumeDownloads";

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
	await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(user)
			.set({ balance: sql`${user.balance} - ${PRICE_PER_USE_CENTS}` })
			.where(eq(user.id, userId))
			.returning({ balance: user.balance });

		if (!updated) return;

		await tx.insert(userTransaction).values({
			userId,
			type,
			amount: -PRICE_PER_USE_CENTS,
			balance: updated.balance,
			remark: TYPE_REMARKS[type],
		});
	});
}

export type UserCenterProfile = {
	username: string;
	email: string;
	status: string;
	balance: number;
};

export async function getUserCenter(userId: string): Promise<UserCenterProfile> {
	const [record] = await db
		.select({
			username: user.username,
			email: user.email,
			status: user.status,
			balance: user.balance,
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!record) throw new ORPCError("NOT_FOUND", { message: "User not found" });

	return record;
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
