import { z } from "zod";
import { adminProcedure } from "../../context";
import { listFeedback, updateFeedbackStatus } from "../feedback/service";
import { listExceptions, listPayments, reviewPayment } from "../payment/service";
import { adminService } from "./service";

const userQuotaSchema = z.object({
	userId: z.string(),
	threadMessagesLimit: z.number().int(),
	resumeAnalysesLimit: z.number().int(),
	resumeDownloadsLimit: z.number().int(),
	threadMessagesUsed: z.number().int(),
	resumeAnalysesUsed: z.number().int(),
	resumeDownloadsUsed: z.number().int(),
	updatedAt: z.date(),
});

const quotaLimitsSchema = z.object({
	threadMessagesLimit: z.number().int().optional(),
	resumeAnalysesLimit: z.number().int().optional(),
	resumeDownloadsLimit: z.number().int().optional(),
});

export const adminRouter = {
	users: {
		list: adminProcedure
			.route({
				method: "GET",
				path: "/admin/users",
				tags: ["Admin"],
				operationId: "adminListUsers",
				summary: "List all users",
				description:
					"Lists users with pagination, optional search, resume counts, and quota information. Requires an admin session.",
				successDescription: "Paginated list of users.",
			})
			.input(
				z.object({
					page: z.number().int().min(1).default(1),
					limit: z.number().int().min(1).max(100).default(20),
					search: z.string().optional(),
				}),
			)
			.output(
				z.object({
					users: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							email: z.string(),
							username: z.string(),
							image: z.string().nullable(),
							role: z.string().nullable(),
							status: z.string().nullable(),
							banned: z.boolean().nullable(),
							emailVerified: z.boolean(),
							balance: z.number().int(),
							createdAt: z.date(),
							updatedAt: z.date(),
							resumeCount: z.number().int(),
							quota: userQuotaSchema.nullable(),
						}),
					),
					total: z.number().int(),
					page: z.number().int(),
					limit: z.number().int(),
				}),
			)
			.handler(({ input }) => adminService.listUsers(input)),

		resumes: adminProcedure
			.route({
				method: "GET",
				path: "/admin/users/{userId}/resumes",
				tags: ["Admin"],
				operationId: "adminGetUserResumes",
				summary: "Get all resumes of a user",
				description:
					"Returns the resume list (without the full resume data payload) for the given user. Requires an admin session.",
				successDescription: "The user profile and their resumes.",
			})
			.input(z.object({ userId: z.string() }))
			.output(
				z.object({
					user: z.object({
						id: z.string(),
						name: z.string(),
						email: z.string(),
						username: z.string(),
						role: z.string().nullable(),
						status: z.string().nullable(),
						banned: z.boolean().nullable(),
					}),
					resumes: z.array(
						z.object({
							id: z.string(),
							name: z.string(),
							slug: z.string(),
							isPublic: z.boolean(),
							isLocked: z.boolean(),
							createdAt: z.date(),
							updatedAt: z.date(),
						}),
					),
				}),
			)
			.handler(({ input }) => adminService.getUserResumes(input)),

		updateStatus: adminProcedure
			.route({
				method: "POST",
				path: "/admin/users/{userId}/status",
				tags: ["Admin"],
				operationId: "adminUpdateUserStatus",
				summary: "Enable or disable a user",
				description: "Bans (disables) or unbans (enables) the given user. Requires an admin session.",
				successDescription: "The user status was updated.",
			})
			.input(
				z.object({
					userId: z.string(),
					banned: z.boolean(),
					banReason: z.string().optional(),
					banExpiresIn: z.union([z.string(), z.number()]).optional(),
				}),
			)
			.handler(({ input }) => adminService.updateUserStatus(input)),

		delete: adminProcedure
			.route({
				method: "DELETE",
				path: "/admin/users/{userId}",
				tags: ["Admin"],
				operationId: "adminDeleteUser",
				summary: "Delete a user",
				description: "Permanently deletes the given user and all of their data. Requires an admin session.",
				successDescription: "The user was deleted.",
			})
			.input(z.object({ userId: z.string() }))
			.output(z.object({ ok: z.boolean() }))
			.handler(async ({ input }) => {
				await adminService.deleteUser(input);
				return { ok: true };
			}),

		approve: adminProcedure
			.route({
				method: "POST",
				path: "/admin/users/{userId}/approve",
				tags: ["Admin"],
				operationId: "adminApproveUser",
				summary: "Approve a pending user",
				description: "Approves and activates a user account that is pending review. Requires an admin session.",
				successDescription: "The user was approved.",
			})
			.input(z.object({ userId: z.string() }))
			.output(z.object({ ok: z.boolean() }))
			.handler(async ({ input }) => {
				await adminService.approveUser(input);
				return { ok: true };
			}),

		resetPassword: adminProcedure
			.route({
				method: "POST",
				path: "/admin/users/{userId}/password",
				tags: ["Admin"],
				operationId: "adminResetUserPassword",
				summary: "Reset a user password",
				description: "Sets a new password for the given user. Requires an admin session.",
				successDescription: "The user password was updated.",
			})
			.input(z.object({ userId: z.string(), newPassword: z.string().min(8) }))
			.output(z.object({ ok: z.boolean() }))
			.handler(async ({ input }) => {
				await adminService.resetUserPassword(input);
				return { ok: true };
			}),

		setBalance: adminProcedure
			.route({
				method: "POST",
				path: "/admin/users/{userId}/balance",
				tags: ["Admin"],
				operationId: "adminSetUserBalance",
				summary: "Set a user balance",
				description: "Sets the recharge balance (in cents) for the given user. Requires an admin session.",
				successDescription: "The updated balance.",
			})
			.input(z.object({ userId: z.string(), balance: z.number().int().min(0) }))
			.output(z.object({ balance: z.number().int() }))
			.handler(({ input }) => adminService.setUserBalance(input)),
	},

	quotas: {
		get: adminProcedure
			.route({
				method: "GET",
				path: "/admin/quotas/{userId}",
				tags: ["Admin"],
				operationId: "adminGetUserQuota",
				summary: "Get a user quota",
				description: "Returns the usage quota for the given user. Requires an admin session.",
				successDescription: "The user quota.",
			})
			.input(z.object({ userId: z.string() }))
			.output(userQuotaSchema)
			.handler(({ input }) => adminService.getUserQuota(input)),

		update: adminProcedure
			.route({
				method: "PUT",
				path: "/admin/quotas/{userId}",
				tags: ["Admin"],
				operationId: "adminUpdateUserQuota",
				summary: "Update a user quota",
				description: "Updates the limits for the given user. A limit of -1 means unlimited. Requires an admin session.",
				successDescription: "The updated user quota.",
			})
			.input(z.object({ userId: z.string(), limits: quotaLimitsSchema }))
			.output(userQuotaSchema)
			.handler(({ input }) => adminService.updateUserQuota(input)),

		resetUsage: adminProcedure
			.route({
				method: "POST",
				path: "/admin/quotas/{userId}/reset",
				tags: ["Admin"],
				operationId: "adminResetUserQuotaUsage",
				summary: "Reset a user quota usage counters",
				description: "Resets the used counters for the given user back to zero. Requires an admin session.",
				successDescription: "The usage counters were reset.",
			})
			.input(z.object({ userId: z.string() }))
			.output(z.object({ ok: z.boolean() }))
			.handler(async ({ input }) => {
				await adminService.resetQuotaUsage(input);
				return { ok: true };
			}),
	},

	feedback: {
		list: adminProcedure
			.route({
				method: "GET",
				path: "/admin/feedback",
				tags: ["Admin"],
				operationId: "adminListFeedback",
				summary: "List user feedback",
				description:
					"Lists user feedback with pagination and optional user/status filters. Requires an admin session.",
			})
			.input(
				z.object({
					page: z.number().int().min(1).default(1),
					limit: z.number().int().min(1).max(100).default(20),
					userId: z.string().optional(),
					status: z.string().optional(),
				}),
			)
			.output(
				z.object({
					items: z.array(
						z.object({
							id: z.string(),
							userId: z.string(),
							username: z.string().nullable(),
							email: z.string().nullable(),
							content: z.string(),
							images: z.array(z.string()),
							status: z.string(),
							createdAt: z.date(),
							updatedAt: z.date(),
						}),
					),
					total: z.number().int(),
					page: z.number().int(),
					limit: z.number().int(),
				}),
			)
			.handler(({ input }) => listFeedback(input)),

		updateStatus: adminProcedure
			.route({
				method: "POST",
				path: "/admin/feedback/{feedbackId}/status",
				tags: ["Admin"],
				operationId: "adminUpdateFeedbackStatus",
				summary: "Update feedback status",
				description: "Updates the status (e.g. open/resolved) of the given feedback. Requires an admin session.",
				successDescription: "The feedback status was updated.",
			})
			.input(z.object({ feedbackId: z.string(), status: z.string().min(1) }))
			.output(z.object({ ok: z.boolean() }))
			.handler(async ({ input }) => {
				await updateFeedbackStatus(input.feedbackId, input.status);
				return { ok: true };
			}),
	},

	payments: {
		list: adminProcedure
			.route({
				method: "GET",
				path: "/admin/payments",
				tags: ["Admin"],
				operationId: "adminListPayments",
				summary: "List payment orders",
				description:
					"Lists recharge payment orders with pagination and optional status/user filters. Requires an admin session.",
			})
			.input(
				z.object({
					page: z.number().int().min(1).default(1),
					limit: z.number().int().min(1).max(100).default(20),
					status: z.string().optional(),
					userId: z.string().optional(),
				}),
			)
			.output(
				z.object({
					orders: z.array(
						z.object({
							id: z.string(),
							userId: z.string(),
							username: z.string().nullable(),
							email: z.string().nullable(),
							orderNo: z.string(),
							amount: z.number().int(),
							status: z.string(),
							codeUrl: z.string().nullable(),
							transactionId: z.string().nullable(),
							paidAt: z.date().nullable(),
							proofUrl: z.string().nullable(),
							contactEmail: z.string().nullable(),
							paidAmount: z.number().int().nullable(),
							expiresAt: z.date(),
							createdAt: z.date(),
							updatedAt: z.date(),
						}),
					),
					total: z.number().int(),
				}),
			)
			.handler(({ input }) => listPayments(input)),

		exceptions: adminProcedure
			.route({
				method: "GET",
				path: "/admin/payments/exceptions",
				tags: ["Admin"],
				operationId: "adminListPaymentExceptions",
				summary: "List payment exception logs",
				description: "Lists payment exception logs with pagination. Requires an admin session.",
			})
			.input(
				z.object({
					page: z.number().int().min(1).default(1),
					limit: z.number().int().min(1).max(100).default(20),
				}),
			)
			.output(
				z.object({
					logs: z.array(
						z.object({
							id: z.string(),
							orderNo: z.string().nullable(),
							userId: z.string().nullable(),
							stage: z.string(),
							errorType: z.string(),
							message: z.string().nullable(),
							rawPayload: z.string().nullable(),
							stack: z.string().nullable(),
							createdAt: z.date(),
						}),
					),
					total: z.number().int(),
				}),
			)
			.handler(({ input }) => listExceptions(input.page, input.limit)),

		review: adminProcedure
			.route({
				method: "POST",
				path: "/admin/payments/{orderId}/review",
				tags: ["Admin"],
				operationId: "adminReviewPayment",
				summary: "Review a recharge request",
				description:
					"Approves (credits the user balance) or rejects a manual recharge request. Requires an admin session.",
				successDescription: "The recharge request was reviewed.",
			})
			.input(z.object({ orderId: z.string(), decision: z.enum(["approve", "reject"]) }))
			.output(z.object({ ok: z.boolean() }))
			.handler(async ({ input }) => {
				await reviewPayment(input.orderId, input.decision);
				return { ok: true };
			}),
	},
};
