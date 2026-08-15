import type { MessageDescriptor } from "@lingui/core";
import type { RouterOutput } from "@/libs/orpc/client";
import { msg, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { CaretLeftIcon, CaretRightIcon, UserCircleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import { Separator } from "@reactive-resume/ui/components/separator";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { RechargeDialog } from "@/features/billing/recharge-dialog";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "./-components/header";

type TransactionItem = RouterOutput["billing"]["listTransactions"]["transactions"][number];

const LIMIT_PER_PAGE = 20;

const TRANSACTION_TYPE_LABELS: Record<string, MessageDescriptor> = {
	threadMessages: msg`Resume generation conversation`,
	resumeAnalyses: msg`Resume analysis`,
	resumeDownloads: msg`Attachment download`,
};

function formatCents(cents: number): string {
	const sign = cents < 0 ? "-" : "";
	const yuan = (Math.abs(cents) / 100).toFixed(2);
	return `${sign}¥${yuan}`;
}

export const Route = createFileRoute("/dashboard/account")({
	component: RouteComponent,
});

function RouteComponent() {
	const { i18n } = useLingui();
	const [page, setPage] = useState(1);
	const [rechargeOpen, setRechargeOpen] = useState(false);

	const profileQuery = useQuery(orpc.billing.getUserCenter.queryOptions());
	const transactionsQuery = useQuery(
		orpc.billing.listTransactions.queryOptions({ input: { page, limit: LIMIT_PER_PAGE } }),
	);
	const paymentConfigQuery = useQuery(orpc.payment.getConfig.queryOptions());

	const profile = profileQuery.data;
	const transactions = transactionsQuery.data?.transactions ?? [];
	const total = transactionsQuery.data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / LIMIT_PER_PAGE));

	const statusVariant =
		profile?.status === "banned" ? "destructive" : profile?.status === "pending" ? "secondary" : "default";

	const typeLabel = (type: string) => {
		const label = TRANSACTION_TYPE_LABELS[type];
		return label ? i18n.t(label) : type;
	};

	return (
		<div className="space-y-4">
			<DashboardHeader icon={UserCircleIcon} title={t`User Center`} />

			<Separator />

			{profileQuery.isLoading ? (
				<div className="flex items-center justify-center py-12">
					<Spinner />
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<div className="rounded-lg border p-4">
						<p className="text-muted-foreground text-xs">
							<Trans>Account</Trans>
						</p>
						<p className="mt-1 font-medium text-sm">{profile?.username}</p>
					</div>

					<div className="rounded-lg border p-4">
						<p className="text-muted-foreground text-xs">
							<Trans>Email</Trans>
						</p>
						<p className="mt-1 font-medium text-sm">{profile?.email}</p>
					</div>

					<div className="rounded-lg border p-4">
						<p className="text-muted-foreground text-xs">
							<Trans>Status</Trans>
						</p>
						<div className="mt-1">
							<Badge variant={statusVariant}>
								{profile?.status === "banned" ? (
									<Trans>Banned</Trans>
								) : profile?.status === "pending" ? (
									<Trans>Pending</Trans>
								) : (
									<Trans>Active</Trans>
								)}
							</Badge>
						</div>
					</div>

					<div className="rounded-lg border p-4">
						<p className="text-muted-foreground text-xs">
							<Trans>Balance</Trans>
						</p>
						<p className="mt-1 font-semibold text-primary text-sm">{formatCents(profile?.balance ?? 0)}</p>
						{paymentConfigQuery.data?.enabled && (
							<Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setRechargeOpen(true)}>
								<Trans>Top Up</Trans>
							</Button>
						)}
					</div>
				</div>
			)}

			<h2 className="pt-2 font-medium text-lg">
				<Trans>Usage Details</Trans>
			</h2>

			{transactionsQuery.isLoading ? (
				<div className="flex items-center justify-center py-12">
					<Spinner />
				</div>
			) : (
				<>
					<div className="overflow-x-auto rounded-lg border">
						<table className="w-full table-auto">
							<thead>
								<tr className="border-b bg-muted/30">
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Type</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Amount</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Tokens</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Remaining Balance</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Remark</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Time</Trans>
									</th>
								</tr>
							</thead>
							<tbody>
								{transactions.length === 0 ? (
									<tr>
										<td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
											<Trans>No transactions yet.</Trans>
										</td>
									</tr>
								) : (
									transactions.map((item: TransactionItem) => (
										<tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/20">
											<td className="px-4 py-3 text-sm">{typeLabel(item.type)}</td>
											<td className="px-4 py-3 font-medium text-red-600 text-sm">{formatCents(item.amount)}</td>
											<td className="px-4 py-3 text-muted-foreground text-sm">
												{item.type === "threadMessages" && item.tokens != null ? item.tokens.toLocaleString(i18n.locale) : "—"}
											</td>
											<td className="px-4 py-3 text-muted-foreground text-sm">{formatCents(item.balance)}</td>
											<td className="px-4 py-3 text-muted-foreground text-sm">{item.remark ?? "—"}</td>
											<td className="whitespace-nowrap px-4 py-3 text-muted-foreground text-sm">
												{Intl.DateTimeFormat(i18n.locale, {
													dateStyle: "medium",
													timeStyle: "short",
												}).format(new Date(item.createdAt))}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>

					{totalPages > 1 && (
						<div className="flex items-center justify-between">
							<span className="text-muted-foreground text-sm">
								<Trans>
									Page {page} of {totalPages} ({total} total)
								</Trans>
							</span>
							<div className="flex items-center gap-1">
								<Button
									size="icon"
									variant="outline"
									className="size-8"
									disabled={page <= 1}
									onClick={() => setPage((p) => Math.max(1, p - 1))}
								>
									<CaretLeftIcon />
								</Button>
								<Button
									size="icon"
									variant="outline"
									className="size-8"
									disabled={page >= totalPages}
									onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
								>
									<CaretRightIcon />
								</Button>
							</div>
						</div>
					)}
				</>
			)}

			<RechargeDialog open={rechargeOpen} onOpenChange={setRechargeOpen} />
		</div>
	);
}
