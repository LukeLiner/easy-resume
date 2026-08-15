import { z } from "zod";

/** 提交反馈时的输入。content 为富文本 HTML，images 为已上传的图片 URL 列表。 */
export const submitFeedbackSchema = z.object({
	content: z.string().min(1, "Feedback content is required").max(50_000),
	images: z.array(z.string().url()).max(9).default([]),
});

export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
