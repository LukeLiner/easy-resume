import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
	CaretLeftIcon,
	CaretRightIcon,
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
	initialQuota: UserItem["quota"];
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
		quota: UserItem["quota"];
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
												<Badge variant={user.banned ? "destructive" : "secondary"}>
													{user.banned ? (
														<Trans>Banned</Trans>
													) : (
														<Trans>Active</Trans>
													)}
												</Badge>
											</td>
											<td className="px-4 py-3 text-center text-muted-foreground text-sm">
												{user.resumeCount}
											</td>
											<td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-sm">
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
																	quota: user.quota,
																})
															}
														>
															<ListNumbersIcon />
															<Trans>Edit Quota</Trans>
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
					initialQuota={quotaDialog.quota}
					onClose={() => setQuotaDialog(null)}
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

function QuotaDialog({ open, userId, userName, initialQuota, onClose }: QuotaDialogProps) {
	const { i18n } = useLingui();
	const queryClient = useQueryClient();

	const [threadMessages, setThreadMessages] = useState(
		String(initialQuota?.threadMessagesLimit ?? -1),
	);
	const [resumeAnalyses, setResumeAnalyses] = useState(
		String(initialQuota?.resumeAnalysesLimit ?? -1),
	);
	const [resumeDownloads, setResumeDownloads] = useState(
		String(initialQuota?.resumeDownloadsLimit ?? -1),
	);

	const updateMutation = useMutation(
		orpc.admin.quotas.update.mutationOptions({
			onSuccess: () => {
				toast.success(i18n.t("Quota updated successfully"));
				void queryClient.invalidateQueries({ queryKey: orpc.admin.users.list.key() });
				onClose();
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const resetMutation = useMutation(
		orpc.admin.quotas.resetUsage.mutationOptions({
			onSuccess: () => {
				toast.success(i18n.t("Usage counters reset"));
				void queryClient.invalidateQueries({ queryKey: orpc.admin.users.list.key() });
			},
			onError: (error) => {
				toast.error(error.message);
			},
		}),
	);

	const handleSave = () => {
		const tml = Number.parseInt(threadMessages, 10);
		const ral = Number.parseInt(resumeAnalyses, 10);
		const rdl = Number.parseInt(resumeDownloads, 10);

		if (Number.isNaN(tml) || Number.isNaN(ral) || Number.isNaN(rdl)) {
			toast.error(i18n.t("Please enter valid numbers"));
			return;
		}

		updateMutation.mutate({
			userId,
			limits: {
				threadMessagesLimit: tml,
				resumeAnalysesLimit: ral,
				resumeDownloadsLimit: rdl,
			},
		});
	};

	const formatLimit = (limit: number) => (limit === -1 ? "\u221E" : String(limit));

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						<Trans>Edit Quota</Trans>
					</DialogTitle>
					<DialogDescription>
						<Trans>
							Configure usage limits for{" "}
							<span className="font-medium">{userName}</span>. Set to -1 for unlimited.
						</Trans>
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<FormItem>
						<FormLabel>
							<Trans>Thread Messages</Trans>
						</FormLabel>
						<FormControl>
							<Input
								type="number"
								min={-1}
								value={threadMessages}
								onChange={(e) => setThreadMessages(e.target.value)}
							/>
						</FormControl>
						{initialQuota && (
							<p className="text-muted-foreground text-xs">
								<Trans>
									Used: {initialQuota.threadMessagesUsed} /{" "}
									{formatLimit(initialQuota.threadMessagesLimit)}
								</Trans>
							</p>
						)}
					</FormItem>

					<FormItem>
						<FormLabel>
							<Trans>Resume Analyses</Trans>
						</FormLabel>
						<FormControl>
							<Input
								type="number"
								min={-1}
								value={resumeAnalyses}
								onChange={(e) => setResumeAnalyses(e.target.value)}
							/>
						</FormControl>
						{initialQuota && (
							<p className="text-muted-foreground text-xs">
								<Trans>
									Used: {initialQuota.resumeAnalysesUsed} /{" "}
									{formatLimit(initialQuota.resumeAnalysesLimit)}
								</Trans>
							</p>
						)}
					</FormItem>

					<FormItem>
						<FormLabel>
							<Trans>Resume Downloads</Trans>
						</FormLabel>
						<FormControl>
							<Input
								type="number"
								min={-1}
								value={resumeDownloads}
								onChange={(e) => setResumeDownloads(e.target.value)}
							/>
						</FormControl>
						{initialQuota && (
							<p className="text-muted-foreground text-xs">
								<Trans>
									Used: {initialQuota.resumeDownloadsUsed} /{" "}
									{formatLimit(initialQuota.resumeDownloadsLimit)}
								</Trans>
							</p>
						)}
					</FormItem>

					<Button
						variant="outline"
						size="sm"
						disabled={resetMutation.isPending}
						onClick={() => resetMutation.mutate({ userId })}
					>
						{resetMutation.isPending ? <Spinner /> : null}
						<Trans>Reset Usage Counters</Trans>
					</Button>
				</div>

				<DialogFooter showCloseButton>
					<Button disabled={updateMutation.isPending} onClick={handleSave}>
						{updateMutation.isPending ? <Spinner /> : null}
						<Trans>Save</Trans>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
