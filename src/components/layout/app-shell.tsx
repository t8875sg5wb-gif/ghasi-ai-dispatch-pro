import { type ReactNode, useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { GlobalSearch, useGlobalSearchHotkey } from "@/components/global-search";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { allNavItems } from "@/lib/navigation";
import { useOrders } from "@/lib/orders-store";
import { useRecurring } from "@/lib/recurring-store";
import { useDrivers } from "@/lib/drivers-store";
import { useInvoices } from "@/lib/invoices-store";
import { syncOrderNotifications } from "@/lib/notifications";
import { logActivity } from "@/lib/protokoll";

/**
 * Hydrates the database-backed stores app-wide so the legacy in-memory mirrors
 * (INITIAL_AUFTRAEGE, DAUERAUFTRAEGE, INITIAL_FAHRER, INITIAL_RECHNUNGEN) always
 * reflect persisted data on every page, not demo seed data. Runs only inside the
 * authenticated shell.
 */
function useHydrateStores() {
  const orders = useOrders();
  useRecurring();
  useDrivers();
  useInvoices();
  useCustomers();
  useVehicles();
  return orders;
}

/**
 * Erzeugt In-App-Benachrichtigungen für dringende, nicht zugewiesene Aufträge
 * und protokolliert neue Warnungen im Audit-Log. Aktualisiert sich minütlich,
 * damit Countdowns/Stufen nachziehen.
 */
function useOrderNotificationSync(auftraege: ReturnType<typeof useHydrateStores>["data"]) {
  const [tick, setTick] = useState(0);
  const protokolliert = useRef<Set<string>>(new Set());

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!auftraege) return;
    const neue = syncOrderNotifications(auftraege);
    for (const n of neue) {
      if (protokolliert.current.has(n.id)) continue;
      protokolliert.current.add(n.id);
      logActivity({
        bereich: "Aufträge",
        entitaet: n.titel,
        aktion: "Warnung: Nicht zugewiesen",
        beschreibung: n.text,
      });
    }
  }, [auftraege, tick]);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [searchOpen, setSearchOpen] = useState(false);
  useGlobalSearchHotkey(setSearchOpen);
  const orders = useHydrateStores();
  useOrderNotificationSync(orders.data);

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
          <NotificationCenter />
          <ThemeToggle />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  );
}
