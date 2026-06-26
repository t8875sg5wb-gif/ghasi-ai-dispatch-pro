import { type ReactNode, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Search, Bell } from "lucide-react";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GlobalSearch, useGlobalSearchHotkey } from "@/components/global-search";
import { UserMenu } from "@/components/layout/user-menu";
import { allNavItems } from "@/lib/navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [searchOpen, setSearchOpen] = useState(false);
  useGlobalSearchHotkey(setSearchOpen);

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
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="relative hidden h-9 w-64 items-center gap-2 rounded-full border border-border/70 bg-muted/50 px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-muted md:flex"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 truncate">Suchen …</span>
            <kbd className="rounded border border-border/70 bg-background px-1.5 text-[10px] font-medium">
              ⌘K
            </kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full md:hidden"
            aria-label="Suchen"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Benachrichtigungen">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
          </Button>
          <ThemeToggle />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  );
}
