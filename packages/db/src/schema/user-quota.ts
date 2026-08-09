import * as pg from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Per-user usage quota for AI/export features.
 * Limits default to thread=5, analyses=2, downloads=1 when a row is created.
 * When no row exists, the quota service returns -1 (unlimited) for backward compatibility.
 * Used counts are incremented atomically by the quota service.
 */
export const userQuota = pg.pgTable(
	"user_quota",
	{
		userId: pg
			.text("user_id")
			.notNull()
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		threadMessagesLimit: pg.integer("thread_messages_limit").notNull().default(5),
		resumeAnalysesLimit: pg.integer("resume_analyses_limit").notNull().default(2),
		resumeDownloadsLimit: pg.integer("resume_downloads_limit").notNull().default(1),
		threadMessagesUsed: pg.integer("thread_messages_used").notNull().default(0),
		resumeAnalysesUsed: pg.integer("resume_analyses_used").notNull().default(0),
		resumeDownloadsUsed: pg.integer("resume_downloads_used").notNull().default(0),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.userId)],
);
