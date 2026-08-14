import type { MessageDescriptor } from "@lingui/core";
import type { RouterOutput } from "@/libs/orpc/client";
import { msg, t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
	CaretLeftIcon,
	CaretRightIcon,
	CheckCircleIcon,
	CreditCardIcon,
	WarningCircleIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import { Separator } from "@reactive-resume/ui/components/separator";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { useConfirm } from "@/hooks/use-confirm";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";

type PaymentOrder = RouterOutput["admin"]["payments"]["list"]["orders"][number];
type ExceptionLog = RouterOutput["admin"]["payments"]["exceptions"]["logs"][number];

const LIMIT_PER_PAGE = 20;

const STATUS_LABELS: Record<string, MessageDescriptor> = {
	pending: msg`Pending`,
	paid: msg`Paid`,
	failed: msg`Failed`,
	expired: msg`Expired`,
	manual_review: msg`Manual Review`,
	rejected: msg`Rejected`,
};

function formatCents(cents: number): string {
	return `¥${(cents / 100).toFixed(2)}`;
}

export const Route = createFileRoute("/dashboard/admin/payments")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (context.session?.user.role !== "admin") throw redirect({ to: "/dashboard", replace: true });
	},
});

function RouteComponent() {
	const { i18n } = useLingui();
	const queryClient = useQueryClient();
	const confirm = useConfirm();
	const [tab, setTab] = useState<"orders" | "exceptions">("orders");
	const [page, setPage] = useState(1);

	const ordersQuery = useQuery(orpc.admin.payments.list.queryOptions({ input: { page, limit: LIMIT_PER_PAGE } }));
	const exceptionsQuery = useQuery(
		orpc.admin.payments.exceptions.queryOptions({ input: { page, limit: LIMIT_PER_PAGE } }),
	);

	const reviewMutation = useMutation(
		orpc.admin.payments.review.mutationOptions({
			onSuccess: () => {
				toast.success(t`Review completed.`);
				void queryClient.invalidateQueries({ queryKey: orpc.admin.payments.list.key() });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const statusLabel = (status: string) => {
		const label = STATUS_LABELS[status];
		return label ? i18n.t(label) : status;
	};

	const statusVariant = (status: string) => {
		if (status === "paid") return "default";
		if (status === "failed" || status === "expired" || status === "rejected") return "destructive";
		if (status === "manual_review") return "secondary";
		return "outline";
	};

	const review = (order: PaymentOrder, decision: "approve" | "reject") => {
		void confirm(decision === "approve" ? t`Approve this recharge?` : t`Reject this recharge?`, {
			description: `${order.orderNo} · ${formatCents(order.amount)}`,
			confirmText: decision === "approve" ? t`Approve` : t`Reject`,
		}).then((ok) => {
			if (ok) reviewMutation.mutate({ orderId: order.id, decision });
		});
	};

	const renderPagination = (total: number, totalPages: number) => {
		if (totalPages <= 1) return null;
		return (
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
		);
	};

	const orders = ordersQuery.data?.orders ?? [];
	const ordersTotal = ordersQuery.data?.total ?? 0;
	const ordersTotalPages = Math.max(1, Math.ceil(ordersTotal / LIMIT_PER_PAGE));

	const exceptions = exceptionsQuery.data?.logs ?? [];
	const exceptionsTotal = exceptionsQuery.data?.total ?? 0;
	const exceptionsTotalPages = Math.max(1, Math.ceil(exceptionsTotal / LIMIT_PER_PAGE));

	return (
		<div className="space-y-4">
			<DashboardHeader icon={CreditCardIcon} title={t`Payment Records`} />

			<Separator />

			<div className="flex items-center gap-2">
				<Button variant={tab === "orders" ? "default" : "outline"} size="sm" onClick={() => setTab("orders")}>
					<Trans>Orders</Trans>
				</Button>
				<Button variant={tab === "exceptions" ? "default" : "outline"} size="sm" onClick={() => setTab("exceptions")}>
					<WarningCircleIcon />
					<Trans>Exception Logs</Trans>
				</Button>
			</div>

			{tab === "orders" ? (
				ordersQuery.isLoading ? (
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
											<Trans>Order No.</Trans>
										</th>
										<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
											<Trans>User</Trans>
										</th>
										<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
											<Trans>Amount</Trans>
										</th>
										<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
											<Trans>Status</Trans>
										</th>
										<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
											<Trans>Proof</Trans>
										</th>
										<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
											<Trans>Created</Trans>
										</th>
										<th className="px-4 py-3 text-end font-medium text-muted-foreground text-sm">
											<Trans>Actions</Trans>
										</th>
									</tr>
								</thead>
								<tbody>
									{orders.length === 0 ? (
										<tr>
											<td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
												<Trans>No payment records found.</Trans>
											</td>
										</tr>
									) : (
										orders.map((order: PaymentOrder) => (
											<tr key={order.id} className="border-b last:border-b-0 hover:bg-muted/20">
												<td className="px-4 py-3 font-mono text-xs">{order.orderNo}</td>
												<td className="px-4 py-3 text-sm">
													<p className="font-medium">{order.username ?? "—"}</p>
													<p className="text-muted-foreground text-xs">{order.email ?? ""}</p>
												</td>
												<td className="px-4 py-3 font-medium text-sm">{formatCents(order.amount)}</td>
												<td className="px-4 py-3">
													<Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge>
												</td>
												<td className="px-4 py-3 text-sm">
													{order.proofUrl ? (
														<a
															href={order.proofUrl}
															target="_blank"
															rel="noreferrer"
															className="text-primary underline-offset-4 hover:underline"
														>
															<Trans>View</Trans>
														</a>
													) : (
														"—"
													)}
												</td>
												<td className="whitespace-nowrap px-4 py-3 text-muted-foreground text-sm">
													{Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium" }).format(new Date(order.createdAt))}
												</td>
												<td className="px-4 py-3">
													{order.status === "manual_review" ? (
														<div className="flex justify-end gap-2">
															<Button
																size="icon"
																variant="outline"
																className="size-8 text-green-600"
																disabled={reviewMutation.isPending}
																onClick={() => review(order, "approve")}
															>
																<CheckCircleIcon />
															</Button>
															<Button
																size="icon"
																variant="outline"
																className="size-8 text-destructive"
																disabled={reviewMutation.isPending}
																onClick={() => review(order, "reject")}
															>
																<XCircleIcon />
															</Button>
														</div>
													) : null}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
						{renderPagination(ordersTotal, ordersTotalPages)}
					</>
				)
			) : exceptionsQuery.isLoading ? (
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
										<Trans>Order No.</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Stage</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Error</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Created</Trans>
									</th>
								</tr>
							</thead>
							<tbody>
								{exceptions.length === 0 ? (
									<tr>
										<td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">
											<Trans>No exception logs found.</Trans>
										</td>
									</tr>
								) : (
									exceptions.map((log: ExceptionLog) => (
										<tr key={log.id} className="border-b last:border-b-0 hover:bg-muted/20">
											<td className="px-4 py-3 font-mono text-xs">{log.orderNo ?? "—"}</td>
											<td className="px-4 py-3 text-muted-foreground text-sm">{log.stage}</td>
											<td className="max-w-md truncate px-4 py-3 text-muted-foreground text-sm">
												{log.errorType}: {log.message ?? ""}
											</td>
											<td className="whitespace-nowrap px-4 py-3 text-muted-foreground text-sm">
												{Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium" }).format(new Date(log.createdAt))}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
					{renderPagination(exceptionsTotal, exceptionsTotalPages)}
				</>
			)}
		</div>
	);
}
