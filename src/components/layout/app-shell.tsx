import { type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Search, Bell } from "lucide-react";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { allNavItems } from "@/lib/navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current =
    allNavItems.find((i) => (i.to === "/" ? pathname === "/" : pathname.startsWith(i.to))) ??
    allNavItems[0];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-background">
        <header className="glass sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border/70 px-3 sm:px-5">
          <SidebarTrigger className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight sm:text-base">
              {current.label}
            </p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {current.description}
            </p>
          </div>
          <div className="relative hidden w-64 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Suchen …"
              className="h-9 rounded-full border-border/70 bg-muted/50 pl-9"
            />
          </div>
          <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Benachrichtigungen">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
          </Button>
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
