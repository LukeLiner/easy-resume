import { adminRouter } from "../features/admin/router";
import { agentRouter } from "../features/agent/router";
import { aiRouter } from "../features/ai/router";
import { aiProvidersRouter } from "../features/ai-providers/router";
import { authRouter } from "../features/auth/router";
import { billingRouter } from "../features/billing/router";
import { feedbackRouter } from "../features/feedback/router";
import { flagsRouter } from "../features/flags/router";
import { paymentRouter } from "../features/payment/router";
import { quotaRouter } from "../features/quota/router";
import { resumeRouter } from "../features/resume/router";
import { storageRouter } from "../features/storage/router";

export default {
	admin: adminRouter,
	ai: aiRouter,
	aiProviders: aiProvidersRouter,
	agent: agentRouter,
	auth: authRouter,
	billing: billingRouter,
	feedback: feedbackRouter,
	flags: flagsRouter,
	payment: paymentRouter,
	quota: quotaRouter,
	resume: resumeRouter,
	storage: storageRouter,
};
