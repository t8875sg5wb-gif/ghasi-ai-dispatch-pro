// Admin-Widget: Dauerauftrag-Ablehnungen der letzten 7 Tage mit Erfolgsquote,
// Top-Gründen und durchschnittlicher Korrekturdauer.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { bewerteAblehnungen } from "@/lib/recurring-rejection-analytics";
import { listRecurringRejections } from "@/lib/recurring-rejections.functions";

const TAGE = 7;

/** Erfolgreich gespeicherte Dauerauftragsvorgänge im Zeitraum (Aktivitätsprotokoll). */
async function ladeErfolgreiche(): Promise<number> {
  const ab = new Date(Date.now() - TAGE * 86_400_000).toISOString();
  const { count, error } = await supabase
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("bereich", "Daueraufträge")
    .in("aktion", ["angelegt", "bearbeitet", "erstellt"])
    .gte("created_at", ab);
  if (error) throw error;
  return count ?? 0;
}

export function AblehnungenWidget() {
  const ladeAblehnungen = useServerFn(listRecurringRejections);
  const ablehnungen = useQuery({
    queryKey: ["recurring_rejections", "widget", TAGE],
    queryFn: () => ladeAblehnungen({ data: { tage: TAGE, limit: 200 } }),
    staleTime: 60_000,
    retry: false,
  });
  const erfolge = useQuery({
    queryKey: ["activity_log", "recurring_success", TAGE],
    queryFn: ladeErfolgreiche,
    staleTime: 60_000,
    retry: false,
  });

  const kennzahlen = useMemo(
    () => bewerteAblehnungen(ablehnungen.data ?? [], erfolge.data ?? 0),
    [ablehnungen.data, erfolge.data],
  );

  const lade = ablehnungen.isLoading || erfolge.isLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-4 text-destructive" aria-hidden="true" />
          Dauerauftrag-Ablehnungen (7 Tage)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {lade ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Lade Kennzahlen …
          </p>
        ) : ablehnungen.isError ? (
          <p className="text-sm text-destructive">
            Kennzahlen konnten nicht geladen werden: {(ablehnungen.error as Error)?.message}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Erfolgsquote</p>
                <p className="text-xl font-semibold">
                  {kennzahlen.erfolgsquote === null
                    ? "–"
                    : `${Math.round(kennzahlen.erfolgsquote * 100)} %`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {kennzahlen.erfolgreich} erfolgreich / {kennzahlen.abgelehnt} abgelehnt
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ablehnungen</p>
                <p className="text-xl font-semibold">{kennzahlen.abgelehnt}</p>
                <p className="text-xs text-muted-foreground">von {kennzahlen.versuche} Versuchen</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ø Korrekturdauer</p>
                <p className="text-xl font-semibold">
                  {kennzahlen.avgKorrekturMinuten === null
                    ? "–"
                    : `${kennzahlen.avgKorrekturMinuten} Min.`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Abstand bis zum nächsten Versuch desselben Vorgangs
                </p>
              </div>
            </div>

            <div>
              <p className="pb-1 text-xs font-medium text-muted-foreground">Top-Gründe</p>
              {kennzahlen.topGruende.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine Ablehnungen in den letzten 7 Tagen.
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {kennzahlen.topGruende.map((g) => (
                    <li key={g.grund} className="flex items-center gap-2">
                      <span className="truncate">{g.grund}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {g.anzahl}×
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {kennzahlen.topPfade.length > 0 && (
              <div>
                <p className="pb-1 text-xs font-medium text-muted-foreground">
                  Häufigste Feldpfade
                </p>
                <div className="flex flex-wrap gap-2">
                  {kennzahlen.topPfade.map((p) => (
                    <Badge key={p.path} variant="outline">
                      {p.label} ({p.path}) · {p.anzahl}×
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button asChild variant="outline" size="sm">
              <Link to="/dauerauftrag-ablehnungen">
                Vollständiger Bericht
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
