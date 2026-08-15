import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@reactive-resume/utils/string";
import { user } from "./auth";

/**
 * 用户使用明细（余额变动流水）。
 * `amount` 与 `balance` 均以「分」为单位存储整数，避免浮点精度问题；
 * 扣费为负值，`balance` 为本次变动后的剩余金额。
 */
export const userTransaction = pg.pgTable(
	"user_transaction",
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
		type: pg.text("type").notNull(),
		amount: pg.integer("amount").notNull(),
		balance: pg.integer("balance").notNull(),
		/** 按 token 计费的类型（如对话生成）消耗的 token 总数；固定计费类型为 null。 */
		tokens: pg.integer("tokens"),
		remark: pg.text("remark"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.index().on(t.userId, t.createdAt)],
);
