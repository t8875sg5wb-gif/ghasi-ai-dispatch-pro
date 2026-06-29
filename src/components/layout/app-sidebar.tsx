import { Link, useRouterState } from "@tanstack/react-router";
import { Bot } from "lucide-react";

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
  useSidebar,
} from "@/components/ui/sidebar";
import { navGroups } from "@/lib/navigation";

export function AppSidebar() {
  const { setOpenMobile, isMobile } = useSidebar();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-4">
        <Link
          to="/"
          onClick={() => isMobile && setOpenMobile(false)}
          className="flex items-center gap-3 overflow-hidden"
        >
          <div className="bg-gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-glow">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <p className="truncate text-base font-bold tracking-tight text-sidebar-foreground">
              GHASI AI
            </p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">
              Digitaler Geschäftsführer
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive(item.to)} tooltip={item.label}>
                      <Link
                        to={item.to}
                        onClick={() => isMobile && setOpenMobile(false)}
                        className="flex items-center gap-3"
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-2.5 group-data-[collapsible=icon]:hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-sm font-semibold text-sidebar-primary">
            GF
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-sidebar-foreground">Geschäftsführung</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">Vollzugriff</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
