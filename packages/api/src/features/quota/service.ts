import { eq } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import { userQuota } from "@reactive-resume/db/schema";
import { assertSufficientBalance, deductBalance } from "../billing/service";

/**
 * Consumption is billed against the user's balance only; balance is the single
 * source of truth for charging. The `user_quota` table and the admin quota
 * helpers below are legacy bookkeeping and no longer gate consumption.
 */
export type QuotaKind = "threadMessages" | "resumeAnalyses" | "resumeDownloads";

export type UserQuota = typeof userQuota.$inferSelect;

export type QuotaLimits = {
	threadMessagesLimit?: number | undefined;
	resumeAnalysesLimit?: number | undefined;
	resumeDownloadsLimit?: number | undefined;
};

const DEFAULT_LIMIT = -1;

export async function getUserQuota(userId: string): Promise<UserQuota> {
	const [row] = await db.select().from(userQuota).where(eq(userQuota.userId, userId)).limit(1);
	if (row) return row;

	return {
		userId,
		threadMessagesLimit: DEFAULT_LIMIT,
		resumeAnalysesLimit: DEFAULT_LIMIT,
		resumeDownloadsLimit: DEFAULT_LIMIT,
		threadMessagesUsed: 0,
		resumeAnalysesUsed: 0,
		resumeDownloadsUsed: 0,
		updatedAt: new Date(),
	};
}

/**
 * Consumes one unit of `kind` by charging the user's balance.
 * Throws `PRECONDITION_FAILED` when the balance is insufficient.
 */
async function consumeQuota(userId: string, kind: QuotaKind): Promise<void> {
	// 余额是唯一门槛：余额足够即放行并扣费，不足时在 assertSufficientBalance 内拒绝。
	await assertSufficientBalance(userId, kind);
	await deductBalance(userId, kind);
}

export function consumeThreadMessageQuota(userId: string): Promise<void> {
	return consumeQuota(userId, "threadMessages");
}

export function consumeResumeAnalysisQuota(userId: string): Promise<void> {
	return consumeQuota(userId, "resumeAnalyses");
}

export function consumeResumeDownloadQuota(userId: string): Promise<void> {
	return consumeQuota(userId, "resumeDownloads");
}

/**
 * Check whether the user still has remaining quota for `kind` WITHOUT consuming.
 * Throws `PRECONDITION_FAILED` when the quota is exhausted.
 * This allows fail-fast checks before starting expensive operations (e.g. AI analysis, file generation).
 */
export async function checkQuota(userId: string, kind: QuotaKind): Promise<void> {
	// 余额是唯一门槛：余额不足时直接拒绝，避免在生成文件/分析之后才失败。
	await assertSufficientBalance(userId, kind);
}

export function checkResumeAnalysisQuota(userId: string): Promise<void> {
	return checkQuota(userId, "resumeAnalyses");
}

export function checkResumeDownloadQuota(userId: string): Promise<void> {
	return checkQuota(userId, "resumeDownloads");
}

/** Admin: upsert the limits for a user, keeping used counters untouched. */
export async function setUserQuota(userId: string, limits: QuotaLimits): Promise<UserQuota> {
	const [existing] = await db.select().from(userQuota).where(eq(userQuota.userId, userId)).limit(1);

	if (existing) {
		const [updated] = await db
			.update(userQuota)
			.set({ ...limits, updatedAt: new Date() })
			.where(eq(userQuota.userId, userId))
			.returning();
		if (updated) return updated;
	}

	const [inserted] = await db
		.insert(userQuota)
		.values({ userId, ...limits })
		.onConflictDoNothing()
		.returning();
	if (inserted) return inserted;

	return getUserQuota(userId);
}

/** Admin: reset usage counters (e.g. when a new billing cycle starts). */
export async function resetUserQuotaUsage(userId: string): Promise<void> {
	await db
		.update(userQuota)
		.set({ threadMessagesUsed: 0, resumeAnalysesUsed: 0, resumeDownloadsUsed: 0, updatedAt: new Date() })
		.where(eq(userQuota.userId, userId));
}
