import { env } from "@reactive-resume/env/server";

export { triggerN8nWebhook } from "@reactive-resume/utils/n8n-webhook";

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
