import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ClipboardList,
  Users,
  Truck,
  BrainCircuit,
  RefreshCw,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/aktivitaeten")({
  head: () => ({
    meta: [
      { title: "Aktivitäten – GHASI AI" },
      {
        name: "description",
        content:
          "Lückenloses Aktivitätsprotokoll: Wer hat wann welche Änderung vorgenommen – nachvollziehbar dokumentiert.",
      },
    ],
  }),
  component: AktivitaetenPage,
});

interface LogRow {
  id: string;
  bereich: string;
  entitaet: string | null;
  aktion: string;
  beschreibung: string;
  akteur: string;
  created_at: string;
}

const bereichIcon: Record<string, typeof Activity> = {
  Aufträge: ClipboardList,
  Fahrer: Users,
  Fahrzeuge: Truck,
  "GHASI AI": BrainCircuit,
};

function relativ(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min`;
  const std = Math.round(min / 60);
  if (std < 24) return `vor ${std} Std`;
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function ladeProtokoll(): Promise<LogRow[]> {
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, bereich, entitaet, aktion, beschreibung, akteur, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as LogRow[];
}

function AktivitaetenPage() {
  const { data, isLoading, refetch, isფetching } = useQuery({
    queryKey: ["activity_log"],
    queryFn: ladeProtokoll,
    refetchInterval: 15000,
  });

  const rows = data ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Aktivitätsprotokoll</h1>
          <p className="text-sm text-muted-foreground">
            Jede wichtige Änderung wird automatisch dokumentiert – nachvollziehbar nach Person, Zeit und Inhalt.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="shrink-0 gap-2">
          <RefreshCw className={isფetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Aktualisieren
        </Button>
      </div>

      <Card className="border-border/70 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Verlauf</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Lade Protokoll …</p>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Noch keine Aktivitäten. Sobald Änderungen vorgenommen werden (z. B. Auftragsstatus oder
                KI-Entscheidungen), erscheinen sie hier.
              </p>
            </div>
          ) : (
            <ol className="relative space-y-1">
              {rows.map((row) => {
                const Icon = bereichIcon[row.bereich] ?? Activity;
                return (
                  <li
                    key={row.id}
                    className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {row.bereich}
                        </Badge>
                        <span className="text-sm font-medium">{row.aktion}</span>
                        {row.entitaet && (
                          <span className="text-xs text-muted-foreground">· {row.entitaet}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{row.beschreibung}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground/80">
                        {row.akteur} · {relativ(row.created_at)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
