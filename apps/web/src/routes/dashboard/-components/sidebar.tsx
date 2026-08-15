import type { MessageDescriptor } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
	BrainIcon,
	ChatCircleDotsIcon,
	CreditCardIcon,
	GearSixIcon,
	ReadCvLogoIcon,
	UserCircleIcon,
	UsersIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@reactive-resume/ui/components/avatar";
import { BrandIcon } from "@reactive-resume/ui/components/brand-icon";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
} from "@reactive-resume/ui/components/sidebar";
import { getInitials } from "@reactive-resume/utils/string";
import { UserDropdownMenu } from "@/features/user/dropdown-menu";
import { Route } from "../route";

type SidebarItem = {
	icon: React.ReactNode;
	label: MessageDescriptor;
	href: React.ComponentProps<typeof Link>["to"];
};

const appSidebarItems = [
	{
		icon: <ReadCvLogoIcon />,
		label: msg`Resumes`,
		href: "/dashboard/resumes",
	},
	{
		icon: <ChatCircleDotsIcon />,
		label: msg`Agents`,
		href: "/agent",
	},
] as const satisfies SidebarItem[];

const settingsSidebarItems = [
	{
		icon: <UserCircleIcon />,
		label: msg`User Center`,
		href: "/dashboard/account",
	},
	{
		icon: <GearSixIcon />,
		label: msg`Preferences`,
		href: "/dashboard/settings/preferences",
	},
	{
		icon: <BrainIcon />,
		label: msg`Integrations`,
		href: "/dashboard/settings/integrations",
	},
] as const satisfies SidebarItem[];

const adminSidebarItems = [
	{
		icon: <UsersIcon />,
		label: msg`User Management`,
		href: "/dashboard/admin/users",
	},
	{
		icon: <CreditCardIcon />,
		label: msg`Payment Records`,
		href: "/dashboard/admin/payments",
	},
] as const satisfies SidebarItem[];

type SidebarItemListProps = {
	items: readonly SidebarItem[];
};

function SidebarItemList({ items }: SidebarItemListProps) {
	const { i18n } = useLingui();

	return (
		<SidebarMenu>
			{items.map((item) => (
				<SidebarMenuItem key={item.href}>
					<SidebarMenuButton
						title={i18n.t(item.label)}
						render={
							<Link to={item.href} activeProps={{ className: "bg-sidebar-accent" }}>
								{item.icon}
								<span className="shrink-0 transition-[margin,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:-ms-8 group-data-[collapsible=icon]:opacity-0">
									{i18n.t(item.label)}
								</span>
							</Link>
						}
					/>
				</SidebarMenuItem>
			))}
		</SidebarMenu>
	);
}

export function DashboardSidebar() {
	const { i18n } = useLingui();
	const { session } = Route.useRouteContext();
	const isAdmin = session.user.role === "admin";

	const visibleSettingsItems = isAdmin
		? settingsSidebarItems
		: settingsSidebarItems.filter((item) => item.href !== "/dashboard/settings/integrations");

	return (
		<Sidebar variant="floating" collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							className="h-auto justify-center"
							render={
								<Link to="/">
									<BrandIcon variant="icon" className="size-12" />
									<h1 className="sr-only">Reactive Resume</h1>
								</Link>
							}
						/>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarSeparator />

			<SidebarContent aria-label={i18n.t(msg`Dashboard`)} role="navigation">
				<SidebarGroup>
					<SidebarGroupLabel>
						<Trans>App</Trans>
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarItemList items={appSidebarItems} />
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>
						<Trans>Settings</Trans>
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarItemList items={visibleSettingsItems} />
					</SidebarGroupContent>
				</SidebarGroup>

				{isAdmin ? (
					<SidebarGroup>
						<SidebarGroupLabel>
							<Trans>Admin</Trans>
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarItemList items={adminSidebarItems} />
						</SidebarGroupContent>
					</SidebarGroup>
				) : null}
			</SidebarContent>

			<SidebarSeparator />

			<SidebarFooter className="gap-y-0">
				<SidebarMenu>
					<SidebarMenuItem>
						<UserDropdownMenu>
							{({ session }) => (
								<SidebarMenuButton className="h-auto gap-x-3 group-data-[collapsible=icon]:p-1!">
									<Avatar className="size-8 shrink-0 transition-all group-data-[collapsible=icon]:size-6">
										<AvatarImage src={session.user.image ?? undefined} />
										<AvatarFallback className="group-data-[collapsible=icon]:text-[0.5rem]">
											{getInitials(session.user.name)}
										</AvatarFallback>
									</Avatar>

									<div className="transition-[margin,opacity] duration-200 ease-in-out group-data-[collapsible=icon]:-ms-8 group-data-[collapsible=icon]:opacity-0">
										<p className="font-medium">{session.user.name}</p>
										<p className="text-muted-foreground text-xs">{session.user.email}</p>
									</div>
								</SidebarMenuButton>
							)}
						</UserDropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
