// Dashboard-Kachel: Dauerauftrag-Ablehnungen heute / 7 Tage mit Trend,
// Top-Gründen, Top-Feldpfaden und Direktlink zum Admin-Bericht.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Loader2, ShieldAlert, TrendingDown, TrendingUp, Minus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { bewerteAblehnungen } from "@/lib/recurring-rejection-analytics";
import { listRecurringRejections } from "@/lib/recurring-rejections.functions";

type Zeitraum = "heute" | "7tage";

interface ZeitraumRange {
  label: string;
  aktuell: { von: Date; bis: Date };
  vorher: { von: Date; bis: Date };
  maxTage: number;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function getRanges(zeitraum: Zeitraum, now: Date): ZeitraumRange {
  if (zeitraum === "heute") {
    const heute = startOfDay(now);
    const gestern = new Date(heute);
    gestern.setDate(gestern.getDate() - 1);
    return {
      label: "heute",
      aktuell: { von: heute, bis: now },
      vorher: { von: gestern, bis: endOfDay(gestern) },
      maxTage: 2,
    };
  }
  const bis = now.getTime();
  const aktuellVon = bis - 7 * 86_400_000;
  const vorherVon = aktuellVon - 7 * 86_400_000;
  return {
    label: "7 Tage",
    aktuell: { von: new Date(aktuellVon), bis: new Date(bis) },
    vorher: { von: new Date(vorherVon), bis: new Date(aktuellVon - 1) },
    maxTage: 14,
  };
}

function isInRange(iso: string, von: Date, bis: Date): boolean {
  const t = new Date(iso).getTime();
  return t >= von.getTime() && t <= bis.getTime();
}

/** Erfolgreich gespeicherte Dauerauftragsvorgänge im Zeitraum (Aktivitätsprotokoll). */
async function ladeErfolgreiche(von: Date, bis: Date): Promise<number> {
  const { count, error } = await supabase
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("bereich", "Daueraufträge")
    .in("aktion", ["angelegt", "bearbeitet", "erstellt"])
    .gte("created_at", von.toISOString())
    .lte("created_at", bis.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export function AblehnungenWidget() {
  const { rollen, rollenGeladen } = useAuth();
  const istAdmin = rollenGeladen && rollen.includes("admin");
  const [zeitraum, setZeitraum] = useState<Zeitraum>("7tage");
  const ladeAblehnungen = useServerFn(listRecurringRejections);

  const now = useMemo(() => new Date(), []);
  const ranges = useMemo(() => getRanges(zeitraum, now), [zeitraum, now]);

  const ablehnungen = useQuery({
    queryKey: ["recurring_rejections", "widget", ranges.maxTage],
    queryFn: () => ladeAblehnungen({ data: { tage: ranges.maxTage, limit: 500 } }),
    staleTime: 60_000,
    retry: false,
    enabled: istAdmin,
  });

  const erfolgeAktuell = useQuery({
    queryKey: ["activity_log", "recurring_success", "aktuell", ranges.label],
    queryFn: () => ladeErfolgreiche(ranges.aktuell.von, ranges.aktuell.bis),
    staleTime: 60_000,
    retry: false,
    enabled: istAdmin,
  });

  const erfolgeVorher = useQuery({
    queryKey: ["activity_log", "recurring_success", "vorher", ranges.label],
    queryFn: () => ladeErfolgreiche(ranges.vorher.von, ranges.vorher.bis),
    staleTime: 60_000,
    retry: false,
    enabled: istAdmin,
  });

  const { aktuell, vorher, trend } = useMemo(() => {
    const rows = ablehnungen.data ?? [];
    const aktuellRows = rows.filter((a) =>
      isInRange(a.zeitpunkt, ranges.aktuell.von, ranges.aktuell.bis),
    );
    const vorherRows = rows.filter((a) =>
      isInRange(a.zeitpunkt, ranges.vorher.von, ranges.vorher.bis),
    );
    const aktuell = bewerteAblehnungen(aktuellRows, erfolgeAktuell.data ?? 0);
    const vorher = bewerteAblehnungen(vorherRows, erfolgeVorher.data ?? 0);
    const diff = aktuell.abgelehnt - vorher.abgelehnt;
    const prozent =
      vorher.abgelehnt > 0
        ? Math.round((diff / vorher.abgelehnt) * 100)
        : aktuell.abgelehnt > 0
          ? 100
          : 0;
    return { aktuell, vorher, trend: { diff, prozent } };
  }, [ablehnungen.data, ranges, erfolgeAktuell.data, erfolgeVorher.data]);

  const lade = ablehnungen.isLoading || erfolgeAktuell.isLoading || erfolgeVorher.isLoading;
  const fehler = ablehnungen.isError || erfolgeAktuell.isError || erfolgeVorher.isError;

  if (!istAdmin) return null;

  const trendIcon =
    trend.diff === 0 ? (
      <Minus className="size-3" aria-hidden="true" />
    ) : trend.diff > 0 ? (
      <TrendingUp className="size-3" aria-hidden="true" />
    ) : (
      <TrendingDown className="size-3" aria-hidden="true" />
    );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="size-4 text-destructive" aria-hidden="true" />
          Dauerauftrag-Ablehnungen
        </CardTitle>
        <ToggleGroup
          type="single"
          value={zeitraum}
          onValueChange={(v) => v && setZeitraum(v as Zeitraum)}
          className="h-8"
        >
          <ToggleGroupItem value="heute" aria-label="Heute" className="text-xs">
            Heute
          </ToggleGroupItem>
          <ToggleGroupItem value="7tage" aria-label="7 Tage" className="text-xs">
            7 Tage
          </ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="space-y-4">
        {lade ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Lade Kennzahlen …
          </p>
        ) : fehler ? (
          <p className="text-sm text-destructive">
            Kennzahlen konnten nicht geladen werden: {(ablehnungen.error as Error)?.message}
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Erfolgsquote</p>
                <p className="text-xl font-semibold">
                  {aktuell.erfolgsquote === null
                    ? "–"
                    : `${Math.round(aktuell.erfolgsquote * 100)} %`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {aktuell.erfolgreich} erfolgreich / {aktuell.abgelehnt} abgelehnt
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Ablehnungen</p>
                  <Badge
                    variant="outline"
                    className={
                      trend.diff === 0
                        ? "text-muted-foreground"
                        : trend.diff > 0
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-success/30 bg-success/10 text-success"
                    }
                  >
                    <span className="flex items-center gap-1">
                      {trendIcon}
                      {trend.diff === 0
                        ? "±0"
                        : `${trend.diff > 0 ? "+" : ""}${trend.diff} (${trend.prozent > 0 ? (trend.diff > 0 ? "+" : "") : ""}${trend.prozent}%)`}
                    </span>
                  </Badge>
                </div>
                <p className="text-xl font-semibold">{aktuell.abgelehnt}</p>
                <p className="text-xs text-muted-foreground">
                  von {aktuell.versuche} Versuchen · Vorperiode {vorher.abgelehnt}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ø Korrekturdauer</p>
                <p className="text-xl font-semibold">
                  {aktuell.avgKorrekturMinuten === null
                    ? "–"
                    : `${aktuell.avgKorrekturMinuten} Min.`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Abstand bis zum nächsten Versuch desselben Vorgangs
                </p>
              </div>
            </div>

            <div>
              <p className="pb-1 text-xs font-medium text-muted-foreground">Top-Fehlerquellen</p>
              {aktuell.topGruende.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine Ablehnungen im gewählten Zeitraum.
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {aktuell.topGruende.map((g) => (
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

            {aktuell.topPfade.length > 0 && (
              <div>
                <p className="pb-1 text-xs font-medium text-muted-foreground">
                  Häufigste Feldpfade
                </p>
                <div className="flex flex-wrap gap-2">
                  {aktuell.topPfade.map((p) => (
                    <Badge key={p.path} variant="outline">
                      {p.label} ({p.path}) · {p.anzahl}×
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Button asChild variant="outline" size="sm">
              <Link to="/dauerauftrag-ablehnungen">
                Zur Admin-Tabelle
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
