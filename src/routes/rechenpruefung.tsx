import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RECHEN_AGENTEN,
  RECHEN_PRUEFSTICHTAG,
  RECHEN_SEITEN_AGENTEN,
  rechenStatusZusammenfassung,
  type RechenStatus,
} from "@/lib/calculation-assurance";

export const Route = createFileRoute("/rechenpruefung")({
  head: () => ({
    meta: [
      { title: "Rechenprüfung – GHASI AI" },
      {
        name: "description",
        content:
          "Amtliche Quellen, Rechen-Agenten und Vergleichssysteme für alle GHASI-Berechnungen.",
      },
    ],
  }),
  component: RechenpruefungPage,
});

function statusInfo(status: RechenStatus) {
  if (status === "gruen") return { text: "Amtlich gedeckt", icon: CheckCircle2 };
  if (status === "gesperrt") return { text: "Fail-closed", icon: LockKeyhole };
  return { text: "Prüfung offen", icon: AlertTriangle };
}
function RechenpruefungPage() {
  const summary = rechenStatusZusammenfassung();

  return (
    <div className="animate-fade-in space-y-6">
      <section>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Rechenprüfung</h1>
            <p className="text-sm text-muted-foreground">
              Prüfstand {RECHEN_PRUEFSTICHTAG}: amtliche Regeln zuerst, Hersteller und Apps nur als
              Gegenprüfung.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{summary.gruen}</p>
            <p className="text-sm text-muted-foreground">amtlich gedeckte Kerne</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{summary.gelb}</p>
            <p className="text-sm text-muted-foreground">fall-/datenabhängig</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{summary.gesperrt}</p>
            <p className="text-sm text-muted-foreground">bewusst fail-closed</p>
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/70">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          GHASI übernimmt keine geheime Herstellerlogik. A = amtliche Primärquelle, B = öffentlich
          dokumentierte Herstellerfunktion, C = tatsächlich ausgeführter synthetischer
          Black-Box-Vergleich. Die unten genannten Vergleichssysteme sind mögliche Gegenprüfungen
          und gelten erst nach dokumentiertem Lauf als bestätigt. Bei Widerspruch zu A wird
          blockiert statt geraten.
        </CardContent>
      </Card>
      <section className="grid gap-4 lg:grid-cols-2">
        {RECHEN_AGENTEN.map((agent) => {
          const status = statusInfo(agent.status);
          const StatusIcon = status.icon;
          const seiten = RECHEN_SEITEN_AGENTEN.filter((s) => s.fachAgentId === agent.id);
          return (
            <Card key={agent.id} className="border-border/70 shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                  </div>
                  <Badge
                    variant={agent.status === "gruen" ? "default" : "secondary"}
                    className="gap-1"
                  >
                    <StatusIcon className="h-3 w-3" /> {status.text}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{agent.zweck}</p>
                <p className="text-xs text-muted-foreground">{agent.statusGrund}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Amtliche / dokumentierte Quellen
                  </p>
                  <div className="space-y-2">
                    {agent.quellen.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Keine allgemeine amtliche Pauschalquelle – betriebliche Belege erforderlich.
                      </p>
                    ) : (
                      agent.quellen.map((quelle) => (
                        <a
                          key={`${agent.id}-${quelle.url}`}
                          href={quelle.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs hover:bg-muted/40"
                        >
                          <span>
                            <strong>{quelle.stufe}</strong> · {quelle.name}
                          </span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        </a>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mögliche / noch zu dokumentierende Gegenprüfungen
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.vergleichssysteme.map((system) => (
                      <Badge key={`${agent.id}-${system}`} variant="outline">
                        {system}
                      </Badge>
                    ))}
                  </div>
                </div>

                {seiten.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Zugeordnete Seiten-Agenten
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {seiten.map((seite) => (
                        <Badge key={seite.id} variant="secondary">
                          {seite.label} · {seite.id}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
