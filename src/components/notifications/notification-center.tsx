// Benachrichtigungszentrale – als Popover an der Glocke im Header.
import { Link } from "@tanstack/react-router";
import { Bell, Check, CheckCheck, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useNotifications,
  markGelesen,
  markAlleGelesen,
  entferne,
  leereAlle,
  NOTIF_STUFE_META,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

function zeitRelativ(ts: number): string {
  const diff = Math.round((Date.now() - ts) / 60000);
  if (diff < 1) return "gerade eben";
  if (diff < 60) return `vor ${diff} Min`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `vor ${h} Std`;
  return `vor ${Math.floor(h / 24)} Tg`;
}

export function NotificationCenter() {
  const items = useNotifications();
  const ungelesen = items.filter((i) => !i.gelesen).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label="Benachrichtigungen"
        >
          <Bell className="h-5 w-5" />
          {ungelesen > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {ungelesen > 9 ? "9+" : ungelesen}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Benachrichtigungen</p>
            <p className="text-xs text-muted-foreground">
              {ungelesen > 0 ? `${ungelesen} ungelesen` : "Alles gelesen"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Alle als gelesen markieren"
              onClick={() => markAlleGelesen()}
              disabled={ungelesen === 0}
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Alle entfernen"
              onClick={() => leereAlle()}
              disabled={items.length === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Keine Benachrichtigungen</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <ul className="divide-y divide-border/60">
              {items.map((n) => {
                const meta = NOTIF_STUFE_META[n.stufe];
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "group relative px-4 py-3 transition-colors hover:bg-muted/50",
                      !n.gelesen && "bg-muted/30",
                    )}
                  >
                    <Link
                      to={n.to}
                      onClick={() => markGelesen(n.id)}
                      className="block pr-6"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">{n.titel}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{n.text}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className={cn("h-4 px-1.5 text-[10px]", meta.badge)}>
                              {meta.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {zeitRelativ(n.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                    <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      {!n.gelesen && (
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                          title="Als gelesen markieren"
                          onClick={() => markGelesen(n.id)}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                        title="Entfernen"
                        onClick={() => entferne(n.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
