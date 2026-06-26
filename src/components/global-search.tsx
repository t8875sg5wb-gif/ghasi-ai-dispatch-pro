import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ClipboardList,
  Users,
  Truck,
  HeartPulse,
  Building2,
  Search as SearchIcon,
  LayoutDashboard,
} from "lucide-react";

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { searchAll, type SearchItem } from "@/lib/ghasi-knowledge";
import { allNavItems } from "@/lib/navigation";

const bereichIcon: Record<string, typeof Users> = {
  Aufträge: ClipboardList,
  Fahrer: Users,
  Fahrzeuge: Truck,
  Patienten: HeartPulse,
  Kunden: Building2,
  Krankenhäuser: Building2,
  Dialysezentren: HeartPulse,
  Pflegeheime: Building2,
};

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchAll(query, 24), [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, SearchItem[]>();
    for (const r of results) {
      const list = map.get(r.bereich) ?? [];
      list.push(r);
      map.set(r.bereich, list);
    }
    return [...map.entries()];
  }, [results]);

  const go = (to: string) => {
    onOpenChange(false);
    setQuery("");
    void navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Aufträge, Fahrer, Fahrzeuge, Patienten, Kunden … durchsuchen"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query ? "Keine Treffer gefunden." : "Tippen, um alle Bereiche zu durchsuchen."}
        </CommandEmpty>

        {grouped.map(([bereich, items]) => {
          const Icon = bereichIcon[bereich] ?? SearchIcon;
          return (
            <CommandGroup key={bereich} heading={bereich}>
              {items.map((item) => (
                <CommandItem
                  key={`${bereich}-${item.id}`}
                  value={`${item.titel} ${item.untertitel} ${item.schlagworte}`}
                  onSelect={() => go(item.to)}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{item.titel}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.untertitel}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        {!query && (
          <CommandGroup heading="Bereiche">
            {allNavItems.map((nav) => (
              <CommandItem key={nav.to} value={`bereich ${nav.label}`} onSelect={() => go(nav.to)}>
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                {nav.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Globaler Cmd/Ctrl+K-Listener. */
export function useGlobalSearchHotkey(setOpen: (fn: (o: boolean) => boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
