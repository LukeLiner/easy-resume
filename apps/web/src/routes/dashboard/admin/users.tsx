import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
	CaretLeftIcon,
	CaretRightIcon,
	ChatCircleTextIcon,
	CheckCircleIcon,
	DotsThreeIcon,
	KeyIcon,
	ListNumbersIcon,
	LockSimpleIcon,
	LockSimpleOpenIcon,
	MagnifyingGlassIcon,
	TrashSimpleIcon,
	UsersIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@reactive-resume/ui/components/badge";
import { Button } from "@reactive-resume/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@reactive-resume/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@reactive-resume/ui/components/dropdown-menu";
import { FormControl, FormItem, FormLabel } from "@reactive-resume/ui/components/form";
import { Input } from "@reactive-resume/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@reactive-resume/ui/components/input-group";
import { Separator } from "@reactive-resume/ui/components/separator";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { useConfirm } from "@/hooks/use-confirm";
import { orpc } from "@/libs/orpc/client";
import type { RouterOutput } from "@/libs/orpc/client";
import { DashboardHeader } from "../-components/header";

type UserItem = RouterOutput["admin"]["users"]["list"]["users"][number];

type PasswordDialogProps = {
	open: boolean;
	userId: string;
	userName: string;
	onClose: () => void;
};

type QuotaDialogProps = {
	open: boolean;
	userId: string;
	userName: string;
	initialBalance: number;
	onClose: () => void;
};

type FeedbackDialogProps = {
	open: boolean;
	userId: string;
	userName: string;
	onClose: () => void;
};

const LIMIT_PER_PAGE = 20;

export const Route = createFileRoute("/dashboard/admin/users")({
	component: RouteComponent,
	beforeLoad: ({ context }) => {
		if (context.session?.user.role !== "admin") throw redirect({ to: "/dashboard", replace: true });
	},
});

function RouteComponent() {
	const { i18n } = useLingui();
	const queryClient = useQueryClient();
	const confirm = useConfirm();

	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [passwordDialog, setPasswordDialog] = useState<{
		userId: string;
		userName: string;
	} | null>(null);
	const [quotaDialog, setQuotaDialog] = useState<{
		userId: string;
		userName: string;
		balance: number;
	} | null>(null);
	const [feedbackDialog, setFeedbackDialog] = useState<{
		userId: string;
		userName: string;
	} | null>(null);

	const { data, isLoading } = useQuery(
		orpc.admin.users.list.queryOptions({
			input: { page, limit: LIMIT_PER_PAGE, search: search || undefined },
		}),
	);
	const users = data?.users ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / LIMIT_PER_PAGE));

	const banMutation = useMutation(
		orpc.admin.users.updateStatus.mutationOptions({
			onSuccess: () => {
				void queryClient.invalidateQueries({ queryKey: orpc.admin.users.list.key() });
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const deleteMutation = useMutation(
		orpc.admin.users.delete.mutationOptions({
			onSuccess: () => {
				toast.success(i18n.t("User deleted successfully"));
				void queryClient.invalidateQueries({ queryKey: orpc.admin.users.list.key() });
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const approveMutation = useMutation(
		orpc.admin.users.approve.mutationOptions({
			onSuccess: () => {
				toast.success(i18n.t("User approved successfully"));
				void queryClient.invalidateQueries({ queryKey: orpc.admin.users.list.key() });
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const handleSearch = () => {
		setPage(1);
		setSearch(searchInput);
	};

	const handleBanToggle = (user: UserItem) => {
		banMutation.mutate({ userId: user.id, banned: !user.banned });
	};

	const handleDelete = async (user: UserItem) => {
		const confirmed = await confirm(i18n.t("Delete User"), {
			description: `Are you sure you want to permanently delete "${user.name}" (${user.email})? This action cannot be undone.`,
			confirmText: i18n.t("Delete"),
			cancelText: i18n.t("Cancel"),
		});
		if (confirmed) {
			deleteMutation.mutate({ userId: user.id });
		}
	};

	return (
		<div className="space-y-4">
			<DashboardHeader icon={UsersIcon} title={t`User Management`} />

			<Separator />

			<div className="flex items-center gap-2">
				<InputGroup className="w-full max-w-sm">
					<InputGroupAddon align="inline-start">
						<MagnifyingGlassIcon />
					</InputGroupAddon>
					<InputGroupInput
						value={searchInput}
						placeholder={t`Search by name, email or username...`}
						onChange={(e) => setSearchInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleSearch();
						}}
					/>
				</InputGroup>
				<Button variant="outline" size="sm" onClick={handleSearch}>
					<Trans>Search</Trans>
				</Button>
				{search && (
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setSearchInput("");
							setSearch("");
							setPage(1);
						}}
					>
						<Trans>Clear</Trans>
					</Button>
				)}
			</div>

			{isLoading ? (
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
										<Trans>Name</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Email</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Username</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Role</Trans>
									</th>
									<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
										<Trans>Status</Trans>
									</th>
									<th className="px-4 py-3 text-center font-medium text-muted-foreground text-sm">
										<Trans>Resumes</Trans>
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
								{users.length === 0 ? (
									<tr>
										<td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">
											<Trans>No users found.</Trans>
										</td>
									</tr>
								) : (
									users.map((user) => (
										<tr key={user.id} className="border-b last:border-b-0 hover:bg-muted/20">
											<td className="px-4 py-3 font-medium text-sm">{user.name}</td>
											<td className="px-4 py-3 text-muted-foreground text-sm">{user.email}</td>
											<td className="px-4 py-3 text-muted-foreground text-sm">{user.username}</td>
											<td className="px-4 py-3 text-sm">
												<Badge variant={user.role === "admin" ? "default" : "secondary"}>
													{user.role ?? "user"}
												</Badge>
											</td>
											<td className="px-4 py-3">
												<Badge
													variant={
														user.status === "banned" || user.banned
															? "destructive"
															: user.status === "pending"
																? "secondary"
																: "default"
													}
												>
													{user.status === "banned" || user.banned ? (
														<Trans>Banned</Trans>
													) : user.status === "pending" ? (
														<Trans>Pending</Trans>
													) : (
														<Trans>Active</Trans>
													)}
												</Badge>
											</td>
											<td className="px-4 py-3 text-center text-muted-foreground text-sm">
												{user.resumeCount}
											</td>
											<td className="text-muted-foreground px-4 py-3 text-sm whitespace-nowrap">
												{Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium" }).format(
													new Date(user.createdAt),
												)}
											</td>
											<td className="px-4 py-3 text-end">
												<DropdownMenu>
													<DropdownMenuTrigger
														render={
															<Button size="icon" variant="ghost" className="size-9">
																<DotsThreeIcon />
															</Button>
														}
													/>
													<DropdownMenuContent align="end">
														{user.status === "pending" && (
															<>
																<DropdownMenuItem
																	onClick={() =>
																		approveMutation.mutate({ userId: user.id })
																	}
																	disabled={approveMutation.isPending}
																>
																	<CheckCircleIcon />
																	<Trans>Approve</Trans>
																</DropdownMenuItem>
																<DropdownMenuSeparator />
															</>
														)}
														<DropdownMenuItem onClick={() => handleBanToggle(user)}>
															{user.banned ? (
																<>
																	<LockSimpleOpenIcon />
																	<Trans>Unban User</Trans>
																</>
															) : (
																<>
																	<LockSimpleIcon />
																	<Trans>Ban User</Trans>
																</>
															)}
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																setPasswordDialog({ userId: user.id, userName: user.name })
															}
														>
															<KeyIcon />
															<Trans>Reset Password</Trans>
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																setQuotaDialog({
																	userId: user.id,
																	userName: user.name,
																	balance: user.balance,
																})
															}
														>
															<ListNumbersIcon />
															<Trans>Edit Quota</Trans>
														</DropdownMenuItem>
														<DropdownMenuItem
															onClick={() =>
																setFeedbackDialog({ userId: user.id, userName: user.name })
															}
														>
															<ChatCircleTextIcon />
															<Trans>View Feedback</Trans>
														</DropdownMenuItem>
														<DropdownMenuSeparator />
														<DropdownMenuItem
															variant="destructive"
															onClick={() => handleDelete(user)}
														>
															<TrashSimpleIcon />
															<Trans>Delete User</Trans>
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
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

			{passwordDialog && (
				<PasswordDialog
					open={passwordDialog !== null}
					userId={passwordDialog.userId}
					userName={passwordDialog.userName}
					onClose={() => setPasswordDialog(null)}
				/>
			)}

			{quotaDialog && (
				<QuotaDialog
					open={quotaDialog !== null}
					userId={quotaDialog.userId}
					userName={quotaDialog.userName}
					initialBalance={quotaDialog.balance}
					onClose={() => setQuotaDialog(null)}
				/>
			)}

			{feedbackDialog && (
				<FeedbackDialog
					open={feedbackDialog !== null}
					userId={feedbackDialog.userId}
					userName={feedbackDialog.userName}
					onClose={() => setFeedbackDialog(null)}
				/>
			)}
		</div>
	);
}

function PasswordDialog({ open, userId, userName, onClose }: PasswordDialogProps) {
	const { i18n } = useLingui();
	const [password, setPassword] = useState("");

	const mutation = useMutation(
		orpc.admin.users.resetPassword.mutationOptions({
			onSuccess: () => {
				toast.success(i18n.t("Password reset successfully"));
				onClose();
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const handleSubmit = () => {
		if (password.length < 8) {
			toast.error(i18n.t("Password must be at least 8 characters"));
			return;
		}
		mutation.mutate({ userId, newPassword: password });
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						<Trans>Reset Password</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>
							Set a new password for{" "}
							<span className="font-medium">{userName}</span>
						</Trans>
					</DialogDescription>
				</DialogHeader>

				<FormItem>
					<FormLabel>
						<Trans>New Password</Trans>
					</FormLabel>
					<FormControl>
						<Input
							type="password"
							value={password}
							placeholder={i18n.t("Minimum 8 characters")}
							onChange={(e) => setPassword(e.target.value)}
						/>
					</FormControl>
				</FormItem>

				<DialogFooter showCloseButton>
					<Button disabled={password.length < 8 || mutation.isPending} onClick={handleSubmit}>
						{mutation.isPending ? <Spinner /> : null}
						<Trans>Reset Password</Trans>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function QuotaDialog({ open, userId, userName, initialBalance, onClose }: QuotaDialogProps) {
	const { i18n } = useLingui();
	const queryClient = useQueryClient();

	const [balance, setBalance] = useState(String(initialBalance / 100));

	const setBalanceMutation = useMutation(
		orpc.admin.users.setBalance.mutationOptions({
			onSuccess: () => {
				toast.success(i18n.t("Balance updated successfully"));
				void queryClient.invalidateQueries({ queryKey: orpc.admin.users.list.key() });
				onClose();
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const handleSave = () => {
		const balanceCents = Math.round(Number(balance) * 100);
		if (!Number.isFinite(balanceCents)) {
			toast.error(i18n.t("Please enter a valid number"));
			return;
		}
		setBalanceMutation.mutate({ userId, balance: balanceCents });
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						<Trans>Edit Quota</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>Configure balance for <span className="font-medium">{userName}</span>.</Trans>
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<FormItem>
						<FormLabel>
							<Trans>Balance</Trans>
						</FormLabel>
						<FormControl>
							<Input
								type="number"
								min={0}
								step={0.01}
								value={balance}
								onChange={(e) => setBalance(e.target.value)}
							/>
						</FormControl>
						<p className="text-muted-foreground text-xs">
							<Trans>In CNY. Credits are added once a recharge is approved.</Trans>
						</p>
					</FormItem>
				</div>

				<DialogFooter showCloseButton>
					<Button disabled={setBalanceMutation.isPending} onClick={handleSave}>
						{setBalanceMutation.isPending ? <Spinner /> : null}
						<Trans>Save</Trans>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function FeedbackDialog({ open, userId, userName, onClose }: FeedbackDialogProps) {
	const { i18n } = useLingui();
	const queryClient = useQueryClient();

	const { data, isLoading } = useQuery(
		orpc.admin.feedback.list.queryOptions({
			input: { page: 1, limit: 50, userId },
		}),
	);
	const items = data?.items ?? [];

	const statusMutation = useMutation(
		orpc.admin.feedback.updateStatus.mutationOptions({
			onSuccess: () => {
				toast.success(i18n.t("Feedback status updated"));
				void queryClient.invalidateQueries({ queryKey: orpc.admin.feedback.list.key() });
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const formatDate = (value: Date | string) =>
		Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						<Trans>User Feedback</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>
							Feedback submitted by <span className="font-medium">{userName}</span>.
						</Trans>
					</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<div className="flex items-center justify-center py-10">
						<Spinner />
					</div>
				) : items.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						<Trans>No feedback submitted by this user yet.</Trans>
					</p>
				) : (
					<div className="space-y-4">
						{items.map((item) => (
							<div key={item.id} className="rounded-lg border p-4">
								<div className="flex items-center justify-between gap-2">
									<span className="text-muted-foreground text-xs">{formatDate(item.createdAt)}</span>
									{item.status === "resolved" ? (
										<Badge variant="default">
											<Trans>Resolved</Trans>
										</Badge>
									) : (
										<Badge variant="secondary">
											<Trans>Open</Trans>
										</Badge>
									)}
								</div>
								<div
									className="prose prose-sm mt-3 max-w-none [&_img]:rounded-md [&_img]:border"
									dangerouslySetInnerHTML={{ __html: item.content }}
								/>
								{item.images.length > 0 && (
									<div className="mt-3 flex flex-wrap gap-2">
										{item.images.map((url) => (
											<a
												key={url}
												href={url}
												target="_blank"
												rel="noreferrer"
												className="size-16 overflow-hidden rounded-md border"
											>
												<img src={url} alt="" className="size-full object-cover" />
											</a>
										))}
									</div>
								)}
								{item.status !== "resolved" && (
									<div className="mt-3 flex justify-end">
										<Button
											variant="outline"
											size="sm"
											disabled={statusMutation.isPending}
											onClick={() => statusMutation.mutate({ feedbackId: item.id, status: "resolved" })}
										>
											<CheckCircleIcon />
											<Trans>Mark as Resolved</Trans>
										</Button>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
