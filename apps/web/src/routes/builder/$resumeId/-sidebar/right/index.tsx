import type { RightSidebarSection } from "@/libs/resume/section";
import { Fragment, lazy, Suspense, useCallback, useRef } from "react";
import { match } from "ts-pattern";
import { Button } from "@reactive-resume/ui/components/button";
import { ScrollArea } from "@reactive-resume/ui/components/scroll-area";
import { Separator } from "@reactive-resume/ui/components/separator";
import { Skeleton } from "@reactive-resume/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@reactive-resume/ui/components/tooltip";
import { getSectionIcon, getSectionTitle, rightSidebarSections } from "@/libs/resume/section";
import { BuilderSidebarEdge } from "../../-components/edge";
import { useBuilderSidebar } from "../../-store/sidebar";

const CustomStylesSectionBuilder = lazy(() =>
	import("./sections/custom-styles").then((m) => ({ default: m.CustomStylesSectionBuilder })),
);
const DesignSectionBuilder = lazy(() =>
	import("./sections/design").then((m) => ({ default: m.DesignSectionBuilder })),
);
const ExportSectionBuilder = lazy(() =>
	import("./sections/export").then((m) => ({ default: m.ExportSectionBuilder })),
);
const LayoutSectionBuilder = lazy(() =>
	import("./sections/layout").then((m) => ({ default: m.LayoutSectionBuilder })),
);
const NotesSectionBuilder = lazy(() =>
	import("./sections/notes").then((m) => ({ default: m.NotesSectionBuilder })),
);
const PageSectionBuilder = lazy(() =>
	import("./sections/page").then((m) => ({ default: m.PageSectionBuilder })),
);
const ResumeAnalysisSectionBuilder = lazy(() =>
	import("./sections/resume-analysis").then((m) => ({ default: m.ResumeAnalysisSectionBuilder })),
);
const SharingSectionBuilder = lazy(() =>
	import("./sections/sharing").then((m) => ({ default: m.SharingSectionBuilder })),
);
const StatisticsSectionBuilder = lazy(() =>
	import("./sections/statistics").then((m) => ({ default: m.StatisticsSectionBuilder })),
);
const TemplateSectionBuilder = lazy(() =>
	import("./sections/template").then((m) => ({ default: m.TemplateSectionBuilder })),
);
const TypographySectionBuilder = lazy(() =>
	import("./sections/typography").then((m) => ({ default: m.TypographySectionBuilder })),
);

function getSectionComponent(type: RightSidebarSection) {
	return match(type)
		.with("template", () => <TemplateSectionBuilder />)
		.with("layout", () => <LayoutSectionBuilder />)
		.with("typography", () => <TypographySectionBuilder />)
		.with("design", () => <DesignSectionBuilder />)
		.with("styles", () => <CustomStylesSectionBuilder />)
		.with("page", () => <PageSectionBuilder />)
		.with("notes", () => <NotesSectionBuilder />)
		.with("sharing", () => <SharingSectionBuilder />)
		.with("statistics", () => <StatisticsSectionBuilder />)
		.with("analysis", () => <ResumeAnalysisSectionBuilder />)
		.with("export", () => <ExportSectionBuilder />)
		.exhaustive();
}

export function BuilderSidebarRight() {
	const scrollAreaRef = useRef<HTMLDivElement | null>(null);

	return (
		<>
			<SidebarEdge />

			<ScrollArea
				ref={scrollAreaRef}
				className="@container h-[calc(100svh-3.5rem)] overflow-hidden bg-background sm:me-12"
			>
				<BuilderSidebarRightContent />
			</ScrollArea>
		</>
	);
}

export function BuilderSidebarRightContent() {
	return (
		<div className="space-y-4 p-4">
			{rightSidebarSections.map((section) => (
				<Fragment key={section}>
					<Suspense fallback={<SectionSkeleton />}>
						{getSectionComponent(section)}
					</Suspense>
					<Separator />
				</Fragment>
			))}
		</div>
	);
}

function SectionSkeleton() {
	return (
		<div className="space-y-3">
			<Skeleton className="h-5 w-24" />
			<Skeleton className="h-10 w-full" />
		</div>
	);
}

function SidebarEdge() {
	const { toggleSidebar } = useBuilderSidebar();

	const scrollToSection = useCallback(
		(section: RightSidebarSection) => {
			toggleSidebar("right", true);
			// Section ids are globally unique; document.getElementById reliably resolves the scroll target.
			document
				.getElementById(`sidebar-${section}`)
				?.scrollIntoView({ block: "start", inline: "nearest", behavior: "smooth" });
		},
		[toggleSidebar],
	);

	return (
		<BuilderSidebarEdge side="right">
			<div className="no-scrollbar min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden">
				<div className="flex min-h-full flex-col items-center justify-center gap-y-2">
					{rightSidebarSections.map((section) => (
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
							<TooltipContent side="left" className="font-medium">
								{getSectionTitle(section)}
							</TooltipContent>
						</Tooltip>
					))}
				</div>
			</div>
		</BuilderSidebarEdge>
	);
}
