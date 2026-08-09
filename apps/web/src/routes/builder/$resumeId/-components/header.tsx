import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import {
	CaretDownIcon,
	CheckCircleIcon,
	CircleNotchIcon,
	CopySimpleIcon,
	DownloadSimpleIcon,
	HouseSimpleIcon,
	LockSimpleIcon,
	LockSimpleOpenIcon,
	PencilSimpleLineIcon,
	SidebarSimpleIcon,
	TrashSimpleIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { match } from "ts-pattern";
import { Button } from "@reactive-resume/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@reactive-resume/ui/components/dropdown-menu";
import { useDialogStore } from "@/dialogs/store";
import {
	useCurrentBuilderResumeSelector,
	useCurrentResume,
	usePatchResume,
	useResumeStore,
} from "@/features/resume/builder/draft";
import { ResumeDownloadDialog } from "@/features/resume/export/download-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { getResumeErrorMessage } from "@/libs/error-message";
import { orpc } from "@/libs/orpc/client";
import { useBuilderSidebar } from "../-store/sidebar";
import { BuilderAiAssistant } from "./ai-assistant";
import { BuilderVersionHistory } from "./version-history";

export function BuilderHeader() {
	// Subscribe to only the metadata fields this header renders. Selecting the whole resume re-renders
	// the header on every keystroke (immer replaces the resume reference on each content edit).
	const name = useCurrentBuilderResumeSelector((resume) => resume.name);
	const isLocked = useCurrentBuilderResumeSelector((resume) => resume.isLocked);
	const resumeId = useCurrentBuilderResumeSelector((resume) => resume.id);
	const { toggleSidebar } = useBuilderSidebar();

	// Equal-width flex-1 side groups keep the center title group truly centered regardless of the
	// wider Download button on the right.
	return (
		<div className="absolute inset-x-0 top-0 z-50 flex h-14 min-w-0 items-center gap-x-2 border-b bg-popover px-1.5">
			<div className="flex min-w-0 flex-1 items-center justify-start">
				{/* Hidden below `md`: on mobile the sidebar panels never mount, so `toggleSidebar` no-ops — the bottom tab bar handles this. */}
				<Button size="icon" variant="ghost" className="hidden md:flex" onClick={() => toggleSidebar("left")}>
					<SidebarSimpleIcon />
					<span className="sr-only">
						<Trans comment="Screen-reader label for opening or closing the left sidebar in resume builder">
							Toggle left sidebar
						</Trans>
					</span>
				</Button>
			</div>

			<div className="flex min-w-0 items-center gap-x-1">
				<Button
					size="icon"
					variant="ghost"
					aria-label={t({
						comment: "Accessible label for button navigating from builder to resumes dashboard",
						message: "Go to resumes dashboard",
					})}
					nativeButton={false}
					render={
						<Link to="/dashboard/resumes" search={{ sort: "lastUpdatedAt", tags: [] }}>
							<HouseSimpleIcon />
						</Link>
					}
				/>
				<span className="me-2.5 text-muted-foreground">/</span>
				<BuilderTitle name={name} isLocked={isLocked} resumeId={resumeId} />
				{isLocked && <LockSimpleIcon className="ms-2 text-muted-foreground" />}
				<SaveStatusIndicator />
				<BuilderAiAssistant resumeId={resumeId} />
				<BuilderVersionHistory resumeId={resumeId} />
				<BuilderHeaderDropdown />
			</div>

			<div className="flex min-w-0 flex-1 items-center justify-end gap-x-1">
				<ResumeDownloadButton />

				<Button size="icon" variant="ghost" className="hidden md:flex" onClick={() => toggleSidebar("right")}>
					<SidebarSimpleIcon className="-scale-x-100" />
					<span className="sr-only">
						<Trans comment="Screen-reader label for opening or closing the right sidebar in resume builder">
							Toggle right sidebar
						</Trans>
					</span>
				</Button>
			</div>
		</div>
	);
}

type BuilderTitleProps = {
	name: string;
	isLocked: boolean;
	resumeId: string;
};

function BuilderTitle({ name, isLocked, resumeId }: BuilderTitleProps) {
	const patchResume = usePatchResume();
	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	// Tracks the last name persisted to the server; guards against Enter→blur double-submits.
	const savedNameRef = useRef(name);

	const { mutateAsync: updateResume } = useMutation(orpc.resume.update.mutationOptions());

	useEffect(() => {
		savedNameRef.current = name;
	}, [name]);

	const handleSave = async (value: string) => {
		const trimmed = value.trim();
		if (trimmed && trimmed !== savedNameRef.current) {
			const previousName = savedNameRef.current;
			savedNameRef.current = trimmed;
			patchResume((draft) => {
				draft.name = trimmed;
			});
			try {
				await updateResume({ id: resumeId, name: trimmed });
			} catch (error) {
				savedNameRef.current = previousName;
				patchResume((draft) => {
					draft.name = previousName;
				});
				toast.error(getResumeErrorMessage(error));
			}
		}
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			void handleSave(e.currentTarget.value);
		} else if (e.key === "Escape") {
			setIsEditing(false);
		}
	};

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				defaultValue={name}
				aria-label={t`Resume title`}
				className="min-w-0 w-full max-w-72 rounded border bg-background px-1.5 py-0.5 font-medium outline-none ring-1 ring-primary"
				onBlur={(e) => void handleSave(e.target.value)}
				onFocus={(e) => e.target.select()}
				onKeyDown={handleKeyDown}
				// eslint-disable-next-line jsx-a11y/no-autofocus
				autoFocus
			/>
		);
	}

	return (
		<h2
			title={isLocked ? t`Locked` : t`Double-click to rename`}
			className={isLocked ? "min-w-0 truncate font-medium" : "min-w-0 cursor-text truncate font-medium"}
			onDoubleClick={() => {
				if (!isLocked) setIsEditing(true);
			}}
		>
			{name}
		</h2>
	);
}

function ResumeDownloadButton() {
	const resume = useCurrentResume();

	return (
		<ResumeDownloadDialog
			resume={resume}
			trigger={(disabled) => (
				<Button
					size="sm"
					aria-label={t({
						comment: "Primary action in the builder header to open resume download options",
						message: "Download options",
					})}
					disabled={disabled}
					className="px-2 sm:px-2.5"
				>
					{disabled ? (
						<CircleNotchIcon className="animate-spin sm:me-1.5" />
					) : (
						<DownloadSimpleIcon className="sm:me-1.5" />
					)}
					<span className="hidden sm:inline">
						<Trans comment="Primary action in the builder header to open resume download options">Download</Trans>
					</span>
				</Button>
			)}
		/>
	);
}

function SaveStatusIndicator() {
	const status = useResumeStore((state) => state.saveStatus);
	if (status === "idle") return null;

	const { icon, label } = match(status)
		.with("saving", () => ({
			icon: <CircleNotchIcon className="animate-spin" />,
			label: t`Saving…`,
		}))
		.with("saved", () => ({ icon: <CheckCircleIcon />, label: t`Saved` }))
		.with("error", () => ({
			icon: <WarningCircleIcon className="text-destructive" />,
			label: t`Couldn't save`,
		}))
		.exhaustive();

	return (
		<span
			className="ms-1 flex shrink-0 items-center gap-x-1 text-muted-foreground text-xs"
			aria-live="polite"
			role="status"
		>
			{icon}
			<span className="hidden md:inline">{label}</span>
		</span>
	);
}

function BuilderHeaderDropdown() {
	const confirm = useConfirm();
	const navigate = useNavigate();
	const { openDialog } = useDialogStore();

	const resume = useCurrentResume();
	const patchResume = usePatchResume();
	const id = resume.id;
	const name = resume.name;
	const slug = resume.slug;
	const tags = resume.tags;
	const isLocked = resume.isLocked;

	const { mutate: deleteResume } = useMutation(orpc.resume.delete.mutationOptions());
	const { mutate: setLockedResume } = useMutation(orpc.resume.setLocked.mutationOptions());

	const handleUpdate = () => {
		openDialog("resume.update", { id, name, slug, tags });
	};

	const handleDuplicate = () => {
		openDialog("resume.duplicate", { id, name, slug, tags, shouldRedirect: true });
	};

	const handleToggleLock = async () => {
		if (!isLocked) {
			const confirmation = await confirm(t`Are you sure you want to lock this resume?`, {
				description: t`When locked, the resume cannot be updated or deleted.`,
			});

			if (!confirmation) return;
		}

		setLockedResume(
			{ id, isLocked: !isLocked },
			{
				onSuccess: () => {
					patchResume((draft) => {
						draft.isLocked = !isLocked;
					});
				},
				onError: (error) => {
					toast.error(getResumeErrorMessage(error));
				},
			},
		);
	};

	const handleDelete = async () => {
		const confirmation = await confirm(t`Are you sure you want to delete this resume?`, {
			description: t`This action cannot be undone.`,
		});

		if (!confirmation) return;

		const toastId = toast.loading(t`Deleting your resume...`);

		deleteResume(
			{ id },
			{
				onSuccess: () => {
					toast.success(t`Your resume has been deleted successfully.`, { id: toastId });
					void navigate({ to: "/dashboard/resumes", search: { sort: "lastUpdatedAt", tags: [] } });
				},
				onError: (error) => {
					toast.error(getResumeErrorMessage(error), { id: toastId });
				},
			},
		);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button size="icon" variant="ghost" aria-label={t`Resume options`}>
						<CaretDownIcon />
					</Button>
				}
			/>

			<DropdownMenuContent>
				<DropdownMenuItem disabled={isLocked} onClick={handleUpdate}>
					<PencilSimpleLineIcon className="me-2" />
					<Trans>Edit details</Trans>
				</DropdownMenuItem>

				<DropdownMenuItem onClick={handleDuplicate}>
					<CopySimpleIcon className="me-2" />
					<Trans>Duplicate</Trans>
				</DropdownMenuItem>

				<DropdownMenuItem onClick={handleToggleLock}>
					{isLocked ? <LockSimpleOpenIcon className="me-2" /> : <LockSimpleIcon className="me-2" />}
					{isLocked ? <Trans>Unlock</Trans> : <Trans>Lock</Trans>}
				</DropdownMenuItem>

				<DropdownMenuSeparator />

				<DropdownMenuItem variant="destructive" disabled={isLocked} onClick={handleDelete}>
					<TrashSimpleIcon className="me-2" />
					<Trans>Delete</Trans>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
