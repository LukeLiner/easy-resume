import { t } from "@lingui/core/macro";
import { BrainIcon } from "@phosphor-icons/react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Separator } from "@reactive-resume/ui/components/separator";
import { IntegrationsSettingsPage } from "@/features/settings/integrations";
import { DashboardHeader } from "../../-components/header";

export const Route = createFileRoute("/dashboard/settings/integrations")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (context.session?.user.role !== "admin") throw redirect({ to: "/dashboard", replace: true });
	},
});

function RouteComponent() {
	return (
		<div className="space-y-4">
			<DashboardHeader icon={BrainIcon} title={t`Integrations`} />

			<Separator />

			<IntegrationsSettingsPage />
		</div>
	);
}
