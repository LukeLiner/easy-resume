import type { RouterOutput } from "@/libs/orpc/client";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { DotsThreeIcon, DownloadSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, m } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { useDialogStore } from "@/dialogs/store";
import { orpc } from "@/libs/orpc/client";
import { ResumeDropdownMenu } from "./menus/dropdown-menu";

type Resume = RouterOutput["resume"]["list"][number];

type ListViewProps = {
	resumes: Resume[];
	hasResumes: boolean;
	ownerName: string;
};

type ResumeListItemProps = {
	resume: Resume;
	ownerName: string;
	isEditing: boolean;
	onEditStart: (id: string) => void;
	onEditEnd: () => void;
};

export function ListView({ resumes, hasResumes, ownerName }: ListViewProps) {
	const { openDialog } = useDialogStore();
	const [editingId, setEditingId] = useState<string>();

	const handleEditStart = useCallback((id: string) => {
		setEditingId(id);
	}, []);

	const handleEditEnd = useCallback(() => {
		setEditingId(undefined);
	}, []);

	if (resumes.length === 0 && hasResumes) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				<Trans>No resumes match your search.</Trans>
			</p>
		);
	}

	if (resumes.length === 0) {
		const handleCreateResume = () => {
			openDialog("resume.create", undefined);
		};

		const handleImportResume = () => {
			openDialog("resume.import", undefined);
		};

		return (
			<div className="flex flex-col gap-y-1">
				<m.div
					className="will-change-[transform,opacity]"
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -20 }}
					transition={{ duration: 0.2, ease: "easeOut" }}
				>
					<Button
						size="lg"
						variant="ghost"
						className="h-12 w-full justify-start gap-x-4 text-start"
						onClick={handleCreateResume}
					>
						<PlusIcon />
						<div className="min-w-0 flex-1 truncate">
							<Trans>Create a new resume</Trans>
						</div>

						<p className="hidden text-xs opacity-60 sm:block">
							<Trans>Start building your resume from scratch</Trans>
						</p>
					</Button>
				</m.div>

				<m.div
					className="will-change-[transform,opacity]"
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -20 }}
					transition={{ duration: 0.2, delay: 0.03, ease: "easeOut" }}
				>
					<Button
						size="lg"
						variant="ghost"
						className="h-12 w-full justify-start gap-x-4 text-start"
						onClick={handleImportResume}
					>
						<DownloadSimpleIcon />

						<div className="min-w-0 flex-1 truncate">
							<Trans>Import an existing resume</Trans>
						</div>

						<p className="hidden text-xs opacity-60 sm:block">
							<Trans>Continue where you left off</Trans>
						</p>
					</Button>
				</m.div>
			</div>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full table-auto">
				<thead>
					<tr className="border-b">
						<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
							<Trans>Title</Trans>
						</th>
						<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
							<Trans>Owner</Trans>
						</th>
						<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
							<Trans>Created</Trans>
						</th>
						<th className="px-4 py-3 text-start font-medium text-muted-foreground text-sm">
							<Trans>Updated</Trans>
						</th>
						<th className="px-4 py-3 text-end font-medium text-muted-foreground text-sm">
							<Trans>Actions</Trans>
						</th>
					</tr>
				</thead>
				<AnimatePresence initial={false} mode="popLayout">
					{resumes.map((resume, index) => (
						<m.tr
							layout
							key={resume.id}
							className="border-b last:border-b-0 will-change-[transform,opacity]"
							initial={{ opacity: 0, y: -20 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -20 }}
							transition={{ duration: 0.18, delay: Math.min(0.12, index * 0.02), ease: "easeOut" }}
						>
							<ResumeListItem
								resume={resume}
								ownerName={ownerName}
								isEditing={editingId === resume.id}
								onEditStart={handleEditStart}
								onEditEnd={handleEditEnd}
							/>
						</m.tr>
					))}
				</AnimatePresence>
			</table>
		</div>
	);
}

function ResumeListItem({ resume, ownerName, isEditing, onEditStart, onEditEnd }: ResumeListItemProps) {
	const { i18n } = useLingui();
	const inputRef = useRef<HTMLInputElement>(null);
	const { mutate: updateResume } = useMutation(orpc.resume.update.mutationOptions());

	const createdAt = useMemo(() => {
		return Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium", timeStyle: "medium" }).format(
			new Date(resume.createdAt),
		);
	}, [i18n.locale, resume.createdAt]);

	const updatedAt = useMemo(() => {
		return Intl.DateTimeFormat(i18n.locale, { dateStyle: "medium", timeStyle: "medium" }).format(
			new Date(resume.updatedAt),
		);
	}, [i18n.locale, resume.updatedAt]);

	const handleSave = (value: string) => {
		const trimmed = value.trim();
		if (trimmed && trimmed !== resume.name) {
			updateResume({ id: resume.id, name: trimmed });
		}
		onEditEnd();
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleSave(e.currentTarget.value);
		} else if (e.key === "Escape") {
			onEditEnd();
		}
	};

	return (
		<>
			<td className="px-4 py-3">
				{isEditing ? (
					<input
						ref={inputRef}
						defaultValue={resume.name}
						className="w-full rounded border bg-background px-1 py-0.5 text-sm font-medium outline-none ring-1 ring-primary"
						onBlur={(e) => handleSave(e.target.value)}
						onKeyDown={handleKeyDown}
						// eslint-disable-next-line jsx-a11y/no-autofocus
						autoFocus
					/>
				) : (
					<Link
						to="/builder/$resumeId"
						params={{ resumeId: resume.id }}
						className="cursor-pointer font-medium hover:underline"
						onDoubleClick={(e) => {
							e.preventDefault();
							onEditStart(resume.id);
						}}
						title="Double-click to rename"
					>
						{resume.name}
					</Link>
				)}
			</td>
			<td className="px-4 py-3 text-muted-foreground text-sm">
				{ownerName}
			</td>
			<td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-sm">
				{createdAt}
			</td>
			<td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-sm">
				{updatedAt}
			</td>
			<td className="px-4 py-3 text-end">
				<ResumeDropdownMenu resume={resume} align="end">
					<Button size="icon" variant="ghost" className="size-9">
						<DotsThreeIcon />
					</Button>
				</ResumeDropdownMenu>
			</td>
		</>
	);
}
