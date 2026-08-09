import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useCallback, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@reactive-resume/ui/components/avatar";
import { Button } from "@reactive-resume/ui/components/button";
import { ScrollArea } from "@reactive-resume/ui/components/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@reactive-resume/ui/components/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@reactive-resume/ui/components/tooltip";
import { getInitials } from "@reactive-resume/utils/string";
import { UserDropdownMenu } from "@/features/user/dropdown-menu";
import { getSectionIcon, getSectionTitle, leftSidebarSections, rightSidebarSections, type SidebarSection } from "@/libs/resume/section";
import { BuilderSidebarLeftContent } from "../-sidebar/left";
import { BuilderSidebarRightContent } from "../-sidebar/right";
import { ResumeAnalysisSectionBuilder } from "../-sidebar/right/sections/resume-analysis";
import { useBuilderSidebar } from "../-store/sidebar";
import { BuilderSidebarEdge } from "./edge";

type BuilderSidebarTab = "content" | "design" | "analysis";

const leftSectionSet = new Set<string>(leftSidebarSections);

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
						<ResumeAnalysisSectionBuilder />
					) : activeTab === "content" ? (
						<BuilderSidebarLeftContent />
					) : (
						<BuilderSidebarRightContent />
					)}
				</ScrollArea>
			</div>
		</>
	);
}
