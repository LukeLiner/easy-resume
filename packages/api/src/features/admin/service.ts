import { ORPCError } from "@orpc/client";
import { hash } from "bcrypt";
import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import * as schema from "@reactive-resume/db/schema";
import { authService } from "../auth/service";
import { getUserQuota, resetUserQuotaUsage, setUserQuota, type QuotaLimits, type UserQuota } from "../quota/service";

export type AdminUserListItem = {
	id: string;
	name: string;
	email: string;
	username: string;
	image: string | null;
	role: string | null;
	status: string | null;
	banned: boolean | null;
	emailVerified: boolean;
	balance: number;
	createdAt: Date;
	updatedAt: Date;
	resumeCount: number;
	quota: UserQuota | null;
};

type ListUsersInput = {
	page: number;
	limit: number;
	search?: string | undefined;
};

type UpdateUserStatusInput = {
	userId: string;
	banned: boolean;
	banReason?: string | undefined;
	/** Relative duration accepted for the ban expiry, e.g. `1d`, `2h`, or a millisecond count. */
	banExpiresIn?: string | number | undefined;
};

type ResetUserPasswordInput = {
	userId: string;
	newPassword: string;
};

type QuotaOperationInput = {
	userId: string;
};

const UNIT_MS: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

function resolveBanExpiry(value?: string | number): Date | null {
	if (value === undefined) return null;

	if (typeof value === "number") return new Date(Date.now() + value);

	const match = /^(\d+)([smhd])$/.exec(value.trim().toLowerCase());
	if (match?.[2]) return new Date(Date.now() + Number(match[1]) * (UNIT_MS[match[2]] ?? 0));

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function requireExistingUser(userId: string) {
	const [userRecord] = await db
		.select({ id: schema.user.id, role: schema.user.role })
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.limit(1);
	if (!userRecord) throw new ORPCError("NOT_FOUND", { message: "User not found" });

	return userRecord;
}

async function assertNotAdmin(userId: string): Promise<void> {
	const userRecord = await requireExistingUser(userId);
	if (userRecord.role === "admin") {
		throw new ORPCError("CONFLICT", { message: "This action is not allowed for admin accounts." });
	}
}

export const adminService = {
	listUsers: async ({ page, limit, search }: ListUsersInput) => {
		const offset = (page - 1) * limit;
		const searchWhere = search
			? or(
					ilike(schema.user.email, `%${search}%`),
					ilike(schema.user.name, `%${search}%`),
					ilike(schema.user.username, `%${search}%`),
				)
			: undefined;

		const [users, totalResult] = 		await Promise.all([
			db
				.select({
					id: schema.user.id,
					name: schema.user.name,
					email: schema.user.email,
					username: schema.user.username,
					image: schema.user.image,
					role: schema.user.role,
					status: schema.user.status,
					banned: schema.user.banned,
					emailVerified: schema.user.emailVerified,
					balance: schema.user.balance,
					createdAt: schema.user.createdAt,
					updatedAt: schema.user.updatedAt,
					})
				.from(schema.user)
				.where(searchWhere)
				.orderBy(desc(schema.user.createdAt))
				.limit(limit)
				.offset(offset),
			db.select({ total: count() }).from(schema.user).where(searchWhere),
		]);

		const userIds = users.map((userRecord) => userRecord.id);
		const [quotaRows, resumeCountRows] =
			userIds.length > 0
				? await Promise.all([
						db.select().from(schema.userQuota).where(inArray(schema.userQuota.userId, userIds)),
						db
							.select({ userId: schema.resume.userId, total: count() })
							.from(schema.resume)
							.where(inArray(schema.resume.userId, userIds))
							.groupBy(schema.resume.userId),
					])
				: [[], []];

		const quotaByUser = new Map(quotaRows.map((quota) => [quota.userId, quota]));
		const resumeCountByUser = new Map(resumeCountRows.map((row) => [row.userId, row.total]));

		return {
			users: users.map<AdminUserListItem>((userRecord) => ({
				...userRecord,
				resumeCount: resumeCountByUser.get(userRecord.id) ?? 0,
				quota: quotaByUser.get(userRecord.id) ?? null,
			})),
			total: totalResult[0]?.total ?? 0,
			page,
			limit,
		};
	},

	getUserResumes: async ({ userId }: QuotaOperationInput) => {
		const [userRecord] = await db
			.select({
				id: schema.user.id,
				name: schema.user.name,
				email: schema.user.email,
				username: schema.user.username,
				role: schema.user.role,
				status: schema.user.status,
				banned: schema.user.banned,
			})
			.from(schema.user)
			.where(eq(schema.user.id, userId))
			.limit(1);
		if (!userRecord) throw new ORPCError("NOT_FOUND", { message: "User not found" });

		const resumes = await db
			.select({
				id: schema.resume.id,
				name: schema.resume.name,
				slug: schema.resume.slug,
				isPublic: schema.resume.isPublic,
				isLocked: schema.resume.isLocked,
				createdAt: schema.resume.createdAt,
				updatedAt: schema.resume.updatedAt,
			})
			.from(schema.resume)
			.where(eq(schema.resume.userId, userId))
			.orderBy(desc(schema.resume.updatedAt));

		return {
			user: {
				id: userRecord.id,
				name: userRecord.name,
				email: userRecord.email,
				username: userRecord.username,
				role: userRecord.role,
				status: userRecord.status,
				banned: userRecord.banned,
			},
			resumes,
		};
	},

	updateUserStatus: async ({ userId, banned, banReason, banExpiresIn }: UpdateUserStatusInput) => {
		await assertNotAdmin(userId);

		await db
			.update(schema.user)
			.set({
				banned,
				status: banned ? "banned" : "active",
				banReason: banned ? (banReason ?? null) : null,
				banExpires: banned ? resolveBanExpiry(banExpiresIn) : null,
			})
			.where(eq(schema.user.id, userId));
	},

	deleteUser: async ({ userId }: QuotaOperationInput) => {
		await assertNotAdmin(userId);

		await authService.deleteAccount({ userId });
	},

	resetUserPassword: async ({ userId, newPassword }: ResetUserPasswordInput) => {
		await assertNotAdmin(userId);

		const passwordHash = await hash(newPassword, 10);
		const [updated] = await db
			.update(schema.account)
			.set({ password: passwordHash })
			.where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")))
			.returning();

		if (!updated) {
			throw new ORPCError("CONFLICT", { message: "The user has no credential password to reset." });
		}
	},

	getUserQuota: async ({ userId }: QuotaOperationInput): Promise<UserQuota> => {
		await requireExistingUser(userId);

		return getUserQuota(userId);
	},

	updateUserQuota: async ({ userId, limits }: { userId: string; limits: QuotaLimits }): Promise<UserQuota> => {
		await requireExistingUser(userId);

		return setUserQuota(userId, limits);
	},

	resetQuotaUsage: async ({ userId }: QuotaOperationInput): Promise<void> => {
		await requireExistingUser(userId);

		await resetUserQuotaUsage(userId);
	},

	approveUser: async ({ userId }: QuotaOperationInput): Promise<void> => {
		await requireExistingUser(userId);

		await db
			.update(schema.user)
			.set({ status: "active" })
			.where(eq(schema.user.id, userId));
	},

	setUserBalance: async ({ userId, balance }: { userId: string; balance: number }): Promise<{ balance: number }> => {
		await requireExistingUser(userId);

		const [updated] = await db
			.update(schema.user)
			.set({ balance })
			.where(eq(schema.user.id, userId))
			.returning({ balance: schema.user.balance });

		return { balance: updated?.balance ?? balance };
	},
};
