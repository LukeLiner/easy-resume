export type N8nWebhookOption = "register" | "charge";

export type N8nWebhookParams = Record<string, string | number | undefined>;

export type N8nWebhookAuth = {
	username: string | undefined;
	password: string | undefined;
};

/**
 * 通过 GET 请求触发 N8N webhook，`option` 表示事件类型。
 * 附加参数会拼接到 query string，调用失败仅记录日志，不阻断主流程。
 * 传入 auth 且用户名/密码均非空时，自动附加 Basic Auth 头。
 */
export async function triggerN8nWebhook(
	webhookUrl: string | undefined,
	option: N8nWebhookOption,
	params?: N8nWebhookParams,
	auth?: N8nWebhookAuth,
): Promise<void> {
	if (!webhookUrl) return;

	try {
		const url = new URL(webhookUrl);
		url.searchParams.set("option", option);
		for (const [key, value] of Object.entries(params ?? {})) {
			if (value === undefined) continue;
			url.searchParams.set(key, String(value));
		}

		const headers: HeadersInit = {};
		if (auth?.username && auth.password) {
			headers.Authorization = `Basic ${btoa(`${auth.username}:${auth.password}`)}`;
		}

		await fetch(url, { method: "GET", headers });
	} catch (error) {
		console.error("Failed to trigger N8N webhook:", error);
	}
}
