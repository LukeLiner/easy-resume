import type { RouterOutput } from "@/libs/orpc/client";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { CaretLeftIcon, CaretRightIcon, ChatCircleTextIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import { Separator } from "@reactive-resume/ui/components/separator";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { ImagePreviewDialog } from "@/features/feedback/image-preview-dialog";
import { orpc } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";

type FeedbackItem = RouterOutput["admin"]["feedback"]["list"]["items"][number];

const LIMIT_PER_PAGE = 20;

export const Route = createFileRoute("/dashboard/admin/feedback")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (context.session?.user.role !== "admin") throw redirect({ to: "/dashboard", replace: true });
	},
});

function RouteComponent() {
	const { i18n } = useLingui();
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "">("");
	const [preview, setPreview] = useState<string | null>(null);

	const query = useQuery(
		orpc.admin.feedback.list.queryOptions({
			input: { page, limit: LIMIT_PER_PAGE, status: statusFilter || undefined },
		}),
	);

	const statusMutation = useMutation(
		orpc.admin.feedback.updateStatus.mutationOptions({
			onSuccess: () => {
				toast.success(t`Feedback status updated.`);
				void queryClient.invalidateQueries({ queryKey: orpc.admin.feedback.list.key() });
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const items = query.data?.items ?? [];
	const total = query.data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / LIMIT_PER_PAGE));

	const formatDate = (value: Date | string) =>
		Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

	const renderPagination = () => {
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

	return (
		<div className="space-y-4">
			<DashboardHeader icon={ChatCircleTextIcon} title={t`Feedback Records`} />

			<Separator />

			<div className="flex items-center gap-2">
				<Button
					variant={statusFilter === "" ? "default" : "outline"}
					size="sm"
					onClick={() => {
						setStatusFilter("");
						setPage(1);
					}}
				>
					<Trans>All</Trans>
				</Button>
				<Button
					variant={statusFilter === "open" ? "default" : "outline"}
					size="sm"
					onClick={() => {
						setStatusFilter("open");
						setPage(1);
					}}
				>
					<Trans>Pending</Trans>
				</Button>
				<Button
					variant={statusFilter === "resolved" ? "default" : "outline"}
					size="sm"
					onClick={() => {
						setStatusFilter("resolved");
						setPage(1);
					}}
				>
					<Trans>Resolved</Trans>
				</Button>
			</div>

			{query.isLoading ? (
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
										<Trans>User</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Content</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Images</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Status</Trans>
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
								{items.length === 0 ? (
									<tr>
										<td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
											<Trans>No feedback records found.</Trans>
										</td>
									</tr>
								) : (
									items.map((item: FeedbackItem) => (
										<tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/20">
											<td className="px-4 py-3 text-sm">
												<p className="font-medium">{item.username ?? "—"}</p>
												<p className="text-muted-foreground text-xs">{item.email ?? ""}</p>
											</td>
											<td className="max-w-md px-4 py-3 text-sm">
												<div
													className="line-clamp-2 text-muted-foreground [&_img]:hidden"
													dangerouslySetInnerHTML={{ __html: item.content }}
												/>
											</td>
											<td className="px-4 py-3">
												{item.images.length > 0 ? (
													<div className="flex items-center gap-1">
														{item.images.slice(0, 3).map((url) => (
															<button
																type="button"
																key={url}
																className="size-10 cursor-zoom-in rounded border"
																title={t`Preview image`}
																onClick={() => setPreview(url)}
															>
																<img src={url} alt="" className="size-full rounded object-cover" />
															</button>
														))}
														{item.images.length > 3 ? (
															<span className="text-muted-foreground text-xs">+{item.images.length - 3}</span>
														) : null}
													</div>
												) : (
													"—"
												)}
											</td>
											<td className="px-4 py-3">
												{item.status === "resolved" ? (
													<Badge variant="default">
														<Trans>Resolved</Trans>
													</Badge>
												) : (
													<Badge variant="secondary">
														<Trans>Pending</Trans>
													</Badge>
												)}
											</td>
											<td className="whitespace-nowrap px-4 py-3 text-muted-foreground text-sm">
												{formatDate(item.createdAt)}
											</td>
											<td className="px-4 py-3">
												{item.status !== "resolved" ? (
													<div className="flex justify-end">
														<Button
															size="icon"
															variant="outline"
															className="size-8 text-green-600"
															disabled={statusMutation.isPending}
															onClick={() => statusMutation.mutate({ feedbackId: item.id, status: "resolved" })}
														>
															<CheckCircleIcon />
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
					{renderPagination()}
				</>
			)}

			<ImagePreviewDialog
				open={preview !== null}
				src={preview ?? ""}
				alt=""
				onOpenChange={(o) => !o && setPreview(null)}
			/>
		</div>
	);
}
