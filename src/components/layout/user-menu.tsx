// Benutzer-Menü im Header: Name, Rolle und Abmelden.
import { LogOut, UserCircle2 } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const { name, role, user, signOut } = useAuth();
  const initialen = name
    .split(/\s+/)
    .map((t) => t[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="bg-gradient-primary relative h-9 w-9 rounded-full text-xs font-semibold text-primary-foreground"
          aria-label="Benutzermenü"
        >
          {initialen || <UserCircle2 className="h-5 w-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user?.email}</span>
          {role && (
            <Badge variant="secondary" className="mt-1 w-fit text-[11px]">
              {ROLE_LABELS[role]}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void signOut()}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Abmelden
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
