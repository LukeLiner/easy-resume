import { z } from "zod";
import { protectedProcedure } from "../../context";
import { checkResumeDownloadQuota, consumeResumeDownloadQuota } from "./service";

export const quotaRouter = {
	checkDownload: protectedProcedure
		.route({
			method: "POST",
			path: "/quotas/check-download",
			tags: ["Quota"],
			operationId: "checkDownloadQuota",
			summary: "Check if user has remaining download quota",
		})
		.input(
			z.object({
				_count: z.number().int().min(1).max(10).default(1),
			}),
		)
		.output(z.void())
		.errors({
			PRECONDITION_FAILED: { message: "Download quota exceeded", status: 429 },
		})
		.handler(async ({ context }) => {
			await checkResumeDownloadQuota(context.user.id);
		}),

	consumeDownload: protectedProcedure
		.route({
			method: "POST",
			path: "/quotas/consume-download",
			tags: ["Quota"],
			operationId: "consumeDownloadQuota",
			summary: "Consume one unit of download quota",
		})
		.input(z.object({}))
		.output(z.void())
		.handler(async ({ context }) => {
			await consumeResumeDownloadQuota(context.user.id);
		}),
};
