// Wiederverwendbares Warn-Panel für dringende, nicht zugewiesene Aufträge.
// Eingesetzt im Dashboard, in der Auftragsliste und im Dispatch-Center.
import { AlertTriangle, ArrowRight, Sparkles, UserX } from "lucide-react";

import type { Auftrag } from "@/lib/auftraege";
import {
  dringendeUnzugewiesene,
  warnStufe,
  minutenBis,
  formatCountdown,
  fehlendeFelder,
  WARN_META,
} from "@/lib/order-urgency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface UnassignedAlertsProps {
  auftraege: Auftrag[];
  /** Auftrag öffnen (z. B. Detail mit KI-Vorschlag). Ohne Callback nur Anzeige. */
  onSelect?: (a: Auftrag) => void;
  /** Maximale Anzahl angezeigter Einträge */
  max?: number;
  /** Kompakte Variante ohne Card-Rahmen */
  bare?: boolean;
  className?: string;
}

export function UnassignedAlerts({
  auftraege,
  onSelect,
  max = 6,
  bare = false,
  className,
}: UnassignedAlertsProps) {
  const now = Date.now();
  const dringend = dringendeUnzugewiesene(auftraege, now);
  if (dringend.length === 0) return null;

  const liste = dringend.slice(0, max);

  const inner = (
    <ul className="space-y-2">
      {liste.map((a) => {
        const stufe = warnStufe(a, now);
        const meta = WARN_META[stufe];
        const m = minutenBis(a, now);
        const fehlt = fehlendeFelder(a);
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onSelect?.(a)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                meta.row || "hover:bg-muted/50",
                onSelect ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {a.nummer} · {a.patient}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="h-5 gap-1 border-destructive/30 bg-destructive/10 px-1.5 text-[10px] text-destructive"
                  >
                    <UserX className="h-3 w-3" />
                    Nicht zugewiesen
                  </Badge>
                  <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px]", meta.badge)}>
                    {formatCountdown(m)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    Fehlt: {fehlt.join(" & ")}
                  </span>
                </div>
              </div>
              {onSelect && (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  KI-Vorschlag
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  if (bare) return <div className={className}>{inner}</div>;

  return (
    <Card className={cn("border-destructive/30 shadow-card", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </span>
          Nicht zugewiesene Aufträge
          <Badge
            variant="outline"
            className="border-destructive/30 bg-destructive/10 text-destructive"
          >
            {dringend.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>{inner}</CardContent>
    </Card>
  );
}
