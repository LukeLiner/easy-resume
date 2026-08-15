import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@reactive-resume/utils/string";
import { user } from "./auth";

/** 反馈状态。 */
export type FeedbackStatus = "open" | "resolved";

/**
 * 用户意见反馈。
 * 由首页右下角客服入口提交，内容为富文本 HTML，可附带图片 URL 列表。
 */
export const feedback = pg.pgTable(
	"feedback",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		userId: pg
			.text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		content: pg.text("content").notNull(),
		images: pg.jsonb("images").$type<string[]>().notNull().default([]),
		status: pg.text("status").notNull().default("open"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.userId, t.createdAt), pg.index().on(t.status)],
);
