import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getRecurringRejection,
  type DauerauftragAblehnungDetail,
} from "@/lib/recurring-rejections.functions";
import { feldLabel } from "@/lib/recurring-validation";
import { regelErklaerung } from "@/lib/recurring-rejection-detail";

export const Route = createFileRoute("/dauerauftrag-ablehnung/$id")({
  head: () => ({
    meta: [
      { title: "Ablehnung im Detail – GHASI AI" },
      {
        name: "description",
        content:
          "Detailansicht einer abgelehnten Dauerauftragsprüfung: bereinigte Eingabewerte und die Ablehnungslogik im Klartext.",
      },
      { property: "og:title", content: "Ablehnung im Detail – GHASI AI" },
      {
        property: "og:description",
        content:
          "Vollständige Eingabewerte ohne sensible Daten sowie die konkrete Ablehnungsregel je Feld.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AblehnungDetailPage,
});

const AKTION_LABEL: Record<string, string> = {
  create: "Neuanlage",
  update: "Änderung",
  delete: "Löschung",
  generate: "Transport-Erzeugung",
};

function formatWert(wert: unknown): string {
  if (wert === null) return "—";
  if (wert === undefined) return "nicht übergeben";
  if (typeof wert === "boolean") return wert ? "ja" : "nein";
  if (typeof wert === "string") return wert.trim() === "" ? "(leer)" : wert;
  if (typeof wert === "number") return String(wert);
  return JSON.stringify(wert, null, 2);
}

function AblehnungDetailPage() {
  const { id } = Route.useParams();
  const laden = useServerFn(getRecurringRejection);
  const { data, isLoading, isError, error } = useQuery<DauerauftragAblehnungDetail>({
    queryKey: ["recurring_rejection", id],
    queryFn: () => laden({ data: { id } }),
  });

  let eingaben: Record<string, unknown> = {};
  try {
    const geparst = data ? (JSON.parse(data.eingabenJson) as unknown) : {};
    if (geparst && typeof geparst === "object" && !Array.isArray(geparst))
      eingaben = geparst as Record<string, unknown>;
  } catch {
    eingaben = {};
  }
  const eintraege = Object.entries(eingaben);
  const fehlerPfade = new Set((data?.felder ?? []).map((f) => f.path.split(".")[0]));

  return (
    <div className="space-y-6">
      <PageHero
        title="Ablehnung im Detail"
        description="Alle übergebenen Eingabewerte in bereinigter Form (ohne sensible Inhalte) sowie die konkrete Ablehnungslogik je Feld."
        icon={ShieldAlert}
      />

      <Button variant="outline" asChild>
        <Link to="/dauerauftrag-ablehnungen">
          <ArrowLeft className="size-4" />
          Zurück zum Bericht
        </Link>
      </Button>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Lade Ablehnung …
        </p>
      ) : isError || !data ? (
        <p className="text-sm text-destructive">
          Ablehnung konnte nicht geladen werden: {(error as Error)?.message ?? "Unbekannter Fehler"}
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vorgang</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{AKTION_LABEL[data.aktion] ?? data.aktion}</Badge>
                {data.patient && <Badge variant="outline">Patient: {data.patient}</Badge>}
                <span className="text-muted-foreground">
                  {new Date(data.zeitpunkt).toLocaleString("de-DE", {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              {data.zielId && (
                <p className="text-xs text-muted-foreground">Datensatz: {data.zielId}</p>
              )}
              <p className="text-muted-foreground">{data.grund}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ablehnungslogik im Klartext</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.felder.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine Feldfehler protokolliert – die Anfrage wurde als Ganzes abgewiesen.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.felder.map((f) => (
                    <li key={f.path} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">
                        {f.label}{" "}
                        <span className="font-normal text-muted-foreground">({f.path})</span>
                      </p>
                      <p className="pt-1 text-sm text-destructive">{f.message}</p>
                      <p className="pt-1 text-xs text-muted-foreground">
                        Regel: {regelErklaerung(f.path)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Übergebene Eingabewerte (bereinigt)</CardTitle>
            </CardHeader>
            <CardContent>
              {eintraege.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Für diesen Vorgang sind keine Eingabewerte protokolliert (Eintrag vor Einführung
                  der Detailansicht).
                </p>
              ) : (
                <>
                  <p className="pb-3 text-xs text-muted-foreground">
                    Sensible Inhalte (Notizen, Telefonnummer, Verordnung) werden nicht gespeichert;
                    Patientenname und Straßenangaben erscheinen nur maskiert.
                  </p>
                  <dl className="divide-y">
                    {eintraege.map(([schluessel, wert]) => (
                      <div key={schluessel} className="grid gap-1 py-2 sm:grid-cols-[16rem_1fr]">
                        <dt className="text-sm font-medium">
                          {feldLabel(schluessel)}
                          <span className="pl-1 font-normal text-muted-foreground">
                            ({schluessel})
                          </span>
                          {fehlerPfade.has(schluessel) && (
                            <Badge variant="destructive" className="ml-2">
                              abgelehnt
                            </Badge>
                          )}
                        </dt>
                        <dd className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                          {formatWert(wert)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
