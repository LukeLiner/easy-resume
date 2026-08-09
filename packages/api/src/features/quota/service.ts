import { ORPCError } from "@orpc/server";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import { userQuota } from "@reactive-resume/db/schema";

/**
 * Feature quotas tracked per user. A limit of `-1` means unlimited.
 * Without an explicit `user_quota` row the user is treated as unlimited,
 * so existing accounts keep working until an admin lowers a limit.
 */
export type QuotaKind = "threadMessages" | "resumeAnalyses" | "resumeDownloads";

export type UserQuota = typeof userQuota.$inferSelect;

export type QuotaLimits = {
	threadMessagesLimit?: number | undefined;
	resumeAnalysesLimit?: number | undefined;
	resumeDownloadsLimit?: number | undefined;
};

const DEFAULT_LIMIT = -1;

const KIND_FIELDS: Record<QuotaKind, { limitKey: "threadMessagesLimit" | "resumeAnalysesLimit" | "resumeDownloadsLimit"; usedKey: "threadMessagesUsed" | "resumeAnalysesUsed" | "resumeDownloadsUsed" }> = {
	threadMessages: { limitKey: "threadMessagesLimit", usedKey: "threadMessagesUsed" },
	resumeAnalyses: { limitKey: "resumeAnalysesLimit", usedKey: "resumeAnalysesUsed" },
	resumeDownloads: { limitKey: "resumeDownloadsLimit", usedKey: "resumeDownloadsUsed" },
};

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
 * Atomically increments the used counter for `kind` unless the limit is
 * already reached. Throws `PRECONDITION_FAILED` when the quota is exhausted.
 */
async function consumeQuota(userId: string, kind: QuotaKind): Promise<void> {
	const { limitKey, usedKey } = KIND_FIELDS[kind];

	const [updated] = await db
		.update(userQuota)
		.set({ [usedKey]: sql`${userQuota[usedKey]} + 1` })
		.where(
			and(
				eq(userQuota.userId, userId),
				or(eq(userQuota[limitKey], DEFAULT_LIMIT), lt(userQuota[usedKey], userQuota[limitKey])),
			),
		)
		.returning();

	if (updated) return;

	// No row yet: create a default (unlimited) row that already counts the usage.
	const [inserted] = await db
		.insert(userQuota)
		.values({ userId, [usedKey]: 1 })
		.onConflictDoNothing()
		.returning();

	if (inserted) return;

	throw new ORPCError("PRECONDITION_FAILED", { message: "Quota exceeded" });
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
	const quota = await getUserQuota(userId);
	const { limitKey, usedKey } = KIND_FIELDS[kind];

	const limit = quota[limitKey];
	const used = quota[usedKey];

	if (limit === DEFAULT_LIMIT) return; // unlimited
	if (used < limit) return;

	const KIND_LABELS: Record<QuotaKind, string> = {
		threadMessages: "thread messages",
		resumeAnalyses: "resume analyses",
		resumeDownloads: "resume downloads",
	};

	throw new ORPCError("PRECONDITION_FAILED", {
		message: `You have exceeded your ${KIND_LABELS[kind]} quota.`,
	});
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
