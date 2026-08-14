import * as pg from "drizzle-orm/pg-core";
import { generateId } from "@reactive-resume/utils/string";
import { user } from "./auth";

/** 充值申请状态。金额均以「分」为单位存储整数。 */
export type PaymentOrderStatus =
	| "pending"
	| "paid"
	| "failed"
	| "expired"
	| "manual_review"
	| "rejected";

/**
 * 手动充值申请。
 * 用户上传支付凭证后进入 `manual_review` 状态，由管理员审核通过后入账。
 * `codeUrl` / `transactionId` 为历史微信支付字段，已不再使用，保留以兼容旧数据。
 */
export const paymentOrder = pg.pgTable(
	"payment_order",
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
		orderNo: pg.text("order_no").notNull().unique(),
		amount: pg.integer("amount").notNull(),
		status: pg.text("status").notNull().default("pending"),
		codeUrl: pg.text("code_url"),
		transactionId: pg.text("transaction_id"),
		paidAt: pg.timestamp("paid_at", { withTimezone: true }),
		proofUrl: pg.text("proof_url"),
		contactEmail: pg.text("contact_email"),
		paidAmount: pg.integer("paid_amount"),
		expiresAt: pg.timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: pg
			.timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date()),
	},
	(t) => [pg.index().on(t.userId, t.createdAt), pg.index().on(t.status)],
);

/**
 * 支付异常日志。用于记录下单、回调验签/解密、入账等各阶段的失败详情，
 * `rawPayload` 为脱敏后的原始报文（不记录密钥与完整支付敏感字段）。
 */
export const paymentExceptionLog = pg.pgTable(
	"payment_exception_log",
	{
		id: pg
			.text("id")
			.notNull()
			.primaryKey()
			.$defaultFn(() => generateId()),
		orderNo: pg.text("order_no"),
		userId: pg.text("user_id").references(() => user.id, { onDelete: "set null" }),
		stage: pg.text("stage").notNull(),
		errorType: pg.text("error_type").notNull(),
		message: pg.text("message"),
		rawPayload: pg.text("raw_payload"),
		stack: pg.text("stack"),
		createdAt: pg.timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(t) => [pg.index().on(t.orderNo), pg.index().on(t.userId, t.createdAt), pg.index().on(t.errorType)],
);
