import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@reactive-resume/ui/components/avatar";
import { Button } from "@reactive-resume/ui/components/button";
import { ScrollArea } from "@reactive-resume/ui/components/scroll-area";
import { Skeleton } from "@reactive-resume/ui/components/skeleton";
import { Spinner } from "@reactive-resume/ui/components/spinner";
import { Tabs, TabsList, TabsTrigger } from "@reactive-resume/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@reactive-resume/ui/components/tooltip";
import { getInitials } from "@reactive-resume/utils/string";
import { usePreviewRenderStore } from "@/features/resume/builder/draft";
import { UserDropdownMenu } from "@/features/user/dropdown-menu";
import { getSectionIcon, getSectionTitle, leftSidebarSections, rightSidebarSections, type RightSidebarSection, type SidebarSection } from "@/libs/resume/section";
import { BuilderSidebarLeftContent } from "../-sidebar/left";
import { BuilderSidebarRightContent } from "../-sidebar/right";
import { useBuilderSidebar } from "../-store/sidebar";
import { BuilderSidebarEdge } from "./edge";

type BuilderSidebarTab = "content" | "design" | "analysis";

const ResumeAnalysisSectionBuilder = lazy(() =>
	import("../-sidebar/right/sections/resume-analysis").then((m) => ({ default: m.ResumeAnalysisSectionBuilder })),
);

const leftSectionSet = new Set<string>(leftSidebarSections);

const PREVIEW_RENDER_TIMEOUT_MS = 15_000;

function PreviewRenderGate({ children }: { children: ReactNode }) {
	const status = usePreviewRenderStore((state) => state.status);
	const setReady = usePreviewRenderStore((state) => state.setReady);

	useEffect(() => {
		if (status === "ready") return;

		// Fallback: never let a stuck preview lock the editor forever.
		const timeoutId = window.setTimeout(() => setReady(), PREVIEW_RENDER_TIMEOUT_MS);
		return () => window.clearTimeout(timeoutId);
	}, [setReady, status]);

	if (status === "ready") return children;

	return (
		<div className="relative min-h-48">
			<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2" aria-live="polite">
				<Spinner className="size-7 text-muted-foreground" />
				<p className="font-medium text-sm text-muted-foreground">{t`Rendering resume preview…`}</p>
				<p className="text-xs text-muted-foreground/70">{t`Editing unlocks once the preview is ready.`}</p>
			</div>
			{/* Keep the fields mounted (draft state and scroll position preserved) but visually dimmed and inert. */}
			<div className="pointer-events-none opacity-40" aria-hidden="true">
				{children}
			</div>
		</div>
	);
}

export function BuilderSidebarCombined() {
	const [activeTab, setActiveTab] = useState<BuilderSidebarTab>("content");
	const { toggleSidebar } = useBuilderSidebar();

	const scrollToSection = useCallback(
		(section: SidebarSection) => {
			toggleSidebar("left", true);
			setActiveTab(section === "analysis" ? "analysis" : leftSectionSet.has(section) ? "content" : "design");

			// Section ids are globally unique; defer scrolling until the active tab has rendered.
			requestAnimationFrame(() => {
				document
					.getElementById(`sidebar-${section}`)
					?.scrollIntoView({ block: "start", inline: "nearest", behavior: "smooth" });
			});
		},
		[toggleSidebar],
	);

	return (
		<>
			<BuilderSidebarEdge side="left">
				<div className="flex min-h-0 w-full flex-1 flex-col items-center gap-y-2 overflow-hidden">
					<div className="no-scrollbar min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden">
						<div className="flex min-h-full flex-col items-center justify-center gap-y-2">
							{[...leftSidebarSections, ...rightSidebarSections].map((section) => (
								<Tooltip key={section}>
									<TooltipTrigger
										render={
											<Button
												size="icon"
												variant="ghost"
												aria-label={getSectionTitle(section)}
												onClick={() => scrollToSection(section)}
											>
												{getSectionIcon(section)}
											</Button>
										}
									/>
									<TooltipContent side="right" className="font-medium">
										{getSectionTitle(section)}
									</TooltipContent>
								</Tooltip>
							))}
						</div>
					</div>

					<UserDropdownMenu>
						{({ session }) => (
							<Button size="icon" variant="ghost" aria-label={t`Account menu`}>
								<Avatar className="size-6">
									<AvatarImage src={session.user.image ?? undefined} />
									<AvatarFallback className="text-[0.5rem]">{getInitials(session.user.name)}</AvatarFallback>
								</Avatar>
							</Button>
						)}
					</UserDropdownMenu>
				</div>
			</BuilderSidebarEdge>

			<div className="flex h-[calc(100svh-3.5rem)] min-w-0 flex-col bg-background sm:ms-12">
				<div className="border-b p-2">
					<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as BuilderSidebarTab)}>
						<TabsList className="grid w-full grid-cols-3">
							<TabsTrigger value="content">
								<Trans>Edit</Trans>
							</TabsTrigger>
							<TabsTrigger value="design">
								<Trans>Design</Trans>
							</TabsTrigger>
							<TabsTrigger value="analysis">
								<Trans>Resume Analysis</Trans>
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>

				<ScrollArea className="@container min-h-0 flex-1">
					{activeTab === "analysis" ? (
						<Suspense fallback={<Skeleton className="h-32 w-full" />}>
							<ResumeAnalysisSectionBuilder />
						</Suspense>
					) : activeTab === "content" ? (
						<PreviewRenderGate>
							<BuilderSidebarLeftContent />
						</PreviewRenderGate>
					) : (
						<BuilderSidebarRightContent
							sections={rightSidebarSections.filter((section: RightSidebarSection) => section !== "analysis")}
						/>
					)}
				</ScrollArea>
			</div>
		</>
	);
}
