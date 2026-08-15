import { ORPCError } from "@orpc/client";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@reactive-resume/db/client";
import { feedback, user } from "@reactive-resume/db/schema";
import type { SubmitFeedbackInput } from "./schema";

export type FeedbackListItem = {
	id: string;
	userId: string;
	username: string | null;
	email: string | null;
	content: string;
	images: string[];
	status: string;
	createdAt: Date;
	updatedAt: Date;
};

type ListFeedbackInput = {
	page: number;
	limit: number;
	userId?: string | undefined;
	status?: string | undefined;
};

export async function submitFeedback(userId: string, input: SubmitFeedbackInput) {
	const [created] = await db
		.insert(feedback)
		.values({ userId, content: input.content, images: input.images })
		.returning();

	if (!created) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Failed to create feedback" });

	return { ok: true as const, feedbackId: created.id };
}

export async function listMyFeedback(userId: string, page: number, limit: number) {
	const offset = (page - 1) * limit;

	const [rows, totalResult] = await Promise.all([
		db
			.select()
			.from(feedback)
			.where(eq(feedback.userId, userId))
			.orderBy(desc(feedback.createdAt))
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(feedback).where(eq(feedback.userId, userId)),
	]);

	return {
		items: rows,
		total: totalResult[0]?.total ?? 0,
		page,
		limit,
	};
}

export async function listFeedback(input: ListFeedbackInput) {
	const offset = (input.page - 1) * input.limit;

	const conditions = [
		input.userId ? eq(feedback.userId, input.userId) : undefined,
		input.status ? eq(feedback.status, input.status) : undefined,
	].filter((condition) => condition !== undefined);

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [rows, totalResult] = await Promise.all([
		db
			.select({
				id: feedback.id,
				userId: feedback.userId,
				username: user.username,
				email: user.email,
				content: feedback.content,
				images: feedback.images,
				status: feedback.status,
				createdAt: feedback.createdAt,
				updatedAt: feedback.updatedAt,
			})
			.from(feedback)
			.innerJoin(user, eq(feedback.userId, user.id))
			.where(where)
			.orderBy(desc(feedback.createdAt))
			.limit(input.limit)
			.offset(offset),
		db.select({ total: count() }).from(feedback).where(where),
	]);

	return {
		items: rows as FeedbackListItem[],
		total: totalResult[0]?.total ?? 0,
		page: input.page,
		limit: input.limit,
	};
}

export async function updateFeedbackStatus(id: string, status: string) {
	const [updated] = await db
		.update(feedback)
		.set({ status })
		.where(eq(feedback.id, id))
		.returning({ id: feedback.id });

	if (!updated) throw new ORPCError("NOT_FOUND", { message: "Feedback not found" });

	return { ok: true as const };
}
