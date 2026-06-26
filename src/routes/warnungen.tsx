import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, ArrowRight } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  computeAlarme,
  ALARM_PRIO_META,
  type Alarm,
  type AlarmPrioritaet,
} from "@/lib/ai-brain";

export const Route = createFileRoute("/warnungen")({
  head: () => ({
    meta: [
      { title: "Alert-Center – GHASI AI" },
      {
        name: "description",
        content:
          "Smart Alert Center von GHASI AI: alle Warnungen zu Wartung, Fristen, Dokumenten, Disposition und Kosten – kategorisiert nach Priorität.",
      },
    ],
  }),
  component: AlertCenter,
});

const PRIOS: AlarmPrioritaet[] = ["Kritisch", "Hoch", "Mittel", "Niedrig"];

function AlertCenter() {
  // Time-relative alerts: compute on the client only (no SSR mismatch).
  const [alarme, setAlarme] = useState<Alarm[]>([]);
  const [filter, setFilter] = useState<AlarmPrioritaet | "alle">("alle");
  useEffect(() => setAlarme(computeAlarme()), []);

  const counts = useMemo(() => {
    const c: Record<AlarmPrioritaet, number> = { Kritisch: 0, Hoch: 0, Mittel: 0, Niedrig: 0 };
    for (const a of alarme) c[a.prioritaet] += 1;
    return c;
  }, [alarme]);

  const gefiltert = filter === "alle" ? alarme : alarme.filter((a) => a.prioritaet === filter);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        icon={ShieldAlert}
        badge={`${alarme.length} Meldungen`}
        title="Smart Alert Center"
        description="GHASI AI überwacht Fristen, Wartung, Dokumente, Disposition und Kosten – priorisiert in Echtzeit."
      />

      {/* Priority summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRIOS.map((p) => {
          const meta = ALARM_PRIO_META[p];
          const active = filter === p;
          return (
            <button
              key={p}
              onClick={() => setFilter(active ? "alle" : p)}
              className={cn(
                "rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-card",
                active ? "border-primary bg-primary/5 shadow-card" : "border-border/70 bg-card shadow-sm",
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", meta.dot)} />
                <span className="text-xs font-medium text-muted-foreground">{p}</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{counts[p]}</p>
            </button>
          );
        })}
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {filter === "alle" ? "Alle Meldungen" : `Priorität: ${filter}`}{" "}
          <span className="text-muted-foreground">({gefiltert.length})</span>
        </p>
        {filter !== "alle" && (
          <button onClick={() => setFilter("alle")} className="text-sm text-primary hover:underline">
            Filter zurücksetzen
          </button>
        )}
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {gefiltert.map((a) => {
          const meta = ALARM_PRIO_META[a.prioritaet];
          return (
            <Link key={a.id} to={a.to} className="group">
              <Card className="h-full border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.ring)}>
                    <ShieldAlert className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-snug">{a.titel}</p>
                      <Badge variant="outline" className={cn("text-[10px]", meta.badge)}>
                        {a.prioritaet}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">{a.bereich}</Badge>
                    </div>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{a.text}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {alarme.length > 0 && gefiltert.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine Meldungen in dieser Priorität.</p>
        )}
        {alarme.length === 0 && (
          <Card className="border-dashed border-border/70 bg-muted/30 sm:col-span-2">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Aktuell keine Warnungen – alles im grünen Bereich.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
