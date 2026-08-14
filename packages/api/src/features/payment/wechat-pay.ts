import { env } from "@reactive-resume/env/server";

/**
 * 手动充值配置与预留 webhook。
 *
 * 原微信支付 Native 下单/回调实现已回退（项目未接入商户号），
 * 现改为「个人收款码 + 上传支付凭证 + 管理员人工审核入账」模式。
 */

/** 最小充值金额：10 元 = 1000 分，且必须为 10 元的整数倍。 */
export const MIN_RECHARGE_CENTS = 1000;

export type PaymentConfig = {
	enabled: boolean;
	qrCodeUrl: string | null;
	minRechargeCents: number;
};

/** 读取手动充值配置。 */
export function getPaymentConfig(): PaymentConfig {
	return {
		enabled: env.PAYMENT_ENABLED,
		qrCodeUrl: env.PAYMENT_QR_CODE_URL ?? null,
		minRechargeCents: MIN_RECHARGE_CENTS,
	};
}

export type N8nWebhookPayload = {
	orderNo: string;
	userId: string;
	amount: number;
	contactEmail?: string | undefined;
	proofUrl: string;
};

/** 预留：充值申请提交成功后向 N8N webhook 推送通知（失败不阻断主流程）。 */
export async function triggerN8nWebhook(payload: N8nWebhookPayload): Promise<void> {
	const webhookUrl = env.PAYMENT_N8N_WEBHOOK_URL;
	if (!webhookUrl) return;

	try {
		await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ event: "recharge.submitted", ...payload }),
		});
	} catch (error) {
		console.error("Failed to trigger N8N webhook:", error);
	}
}
