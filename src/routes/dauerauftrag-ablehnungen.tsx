import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Download, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { PageHero } from "@/components/enterprise/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toCsv, downloadCsv } from "@/lib/export-utils";
import { listRecurringRejections } from "@/lib/recurring-rejections.functions";

export const Route = createFileRoute("/dauerauftrag-ablehnungen")({
  head: () => ({
    meta: [
      { title: "Abgelehnte Daueraufträge – GHASI AI" },
      {
        name: "description",
        content:
          "Admin-Bericht über ungültige oder abgelehnte Dauerauftragsversuche mit Grund, betroffenen Feldern und Zeitpunkt.",
      },
      { property: "og:title", content: "Abgelehnte Daueraufträge – GHASI AI" },
      {
        property: "og:description",
        content:
          "Protokoll aller abgewiesenen Dauerauftragsversuche: Aktion, Grund, fehlerhafte Felder und Zeitpunkt.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AblehnungenPage,
});

const AKTION_LABEL: Record<string, string> = {
  create: "Neuanlage",
  update: "Änderung",
  delete: "Löschung",
  generate: "Transport-Erzeugung",
};

function formatZeit(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

function AblehnungenPage() {
  const [tage, setTage] = useState("30");
  const fetchAblehnungen = useServerFn(listRecurringRejections);
  const {
    data = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["recurring_rejections", tage],
    queryFn: () => fetchAblehnungen({ data: { tage: Number(tage) } }),
    staleTime: 15_000,
  });

  const topFelder = useMemo(() => {
    const zaehler = new Map<string, number>();
    for (const a of data)
      for (const f of a.felder) zaehler.set(f.label, (zaehler.get(f.label) ?? 0) + 1);
    return [...zaehler.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data]);

  const exportiereCsv = () => {
    if (data.length === 0) {
      toast.info("Keine Daten für den gewählten Zeitraum vorhanden.");
      return;
    }
    const rows = data.map((a) => ({
      Zeitpunkt: formatZeit(a.zeitpunkt),
      Aktion: AKTION_LABEL[a.aktion] ?? a.aktion,
      Patient: a.patient ?? "",
      Grund: a.grund,
      "Ziel-ID": a.zielId ?? "",
      Felder: a.felder.map((f) => `${f.label} (${f.path}): ${f.message}`).join(" | "),
    }));
    const filename = `dauerauftrag-ablehnungen-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, toCsv(rows));
    toast.success("CSV-Export wurde heruntergeladen.");
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="Abgelehnte Daueraufträge"
        description="Alle ungültigen oder abgewiesenen Dauerauftragsversuche mit Grund, betroffenen Feldern und Zeitpunkt. Nur für Administratoren sichtbar."
        icon={ShieldAlert}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={tage} onValueChange={setTage}>
          <SelectTrigger className="w-48" aria-label="Zeitraum wählen">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Letzte 7 Tage</SelectItem>
            <SelectItem value="30">Letzte 30 Tage</SelectItem>
            <SelectItem value="90">Letzte 90 Tage</SelectItem>
            <SelectItem value="365">Letzte 12 Monate</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Aktualisieren
        </Button>
        <Button variant="outline" onClick={exportiereCsv}>
          <Download className="size-4" />
          CSV-Export
        </Button>
        <Badge variant="secondary">{data.length} Einträge</Badge>
      </div>

      {topFelder.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Häufigste Fehlerquellen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {topFelder.map(([label, anzahl]) => (
              <Badge key={label} variant="outline">
                {label} · {anzahl}×
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Protokoll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Lade Protokoll …
            </p>
          ) : isError ? (
            <p className="text-sm text-destructive">
              Protokoll konnte nicht geladen werden: {(error as Error)?.message}
            </p>
          ) : data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine abgelehnten Dauerauftragsversuche im gewählten Zeitraum.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.map((a) => (
                <li key={a.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
                    <span className="text-sm font-medium">
                      {AKTION_LABEL[a.aktion] ?? a.aktion}
                    </span>
                    {a.patient && <Badge variant="secondary">{a.patient}</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatZeit(a.zeitpunkt)}
                    </span>
                  </div>
                  <p className="pt-2 text-sm text-muted-foreground">{a.grund}</p>
                  {a.felder.length > 0 && (
                    <ul className="pt-2 space-y-0.5 text-xs">
                      {a.felder.map((f) => (
                        <li key={f.path}>
                          <span className="font-medium">{f.label}</span>{" "}
                          <span className="text-muted-foreground">({f.path})</span>: {f.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.zielId && (
                    <p className="pt-1 text-xs text-muted-foreground">Datensatz: {a.zielId}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
