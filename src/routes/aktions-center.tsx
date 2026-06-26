import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Inbox, ShieldCheck, Plug, CheckCircle2 } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DraftCard } from "@/components/kommunikation/draft-card";
import { cn } from "@/lib/utils";
import { INTEGRATIONEN } from "@/lib/communication";
import { useEntwuerfe, ladeEntwuerfe } from "@/lib/communication-store";

export const Route = createFileRoute("/aktions-center")({
  head: () => ({
    meta: [
      { title: "Aktions-Center – GHASI AI" },
      {
        name: "description",
        content:
          "Aktions-Center von GHASI AI: alle KI-generierten Nachrichten-Entwürfe (SMS, E-Mail, WhatsApp) warten auf manuelle Freigabe. Die KI versendet niemals automatisch.",
      },
    ],
  }),
  component: AktionsCenter,
});

type StatusFilter = "offen" | "genehmigt" | "abgelehnt" | "alle";

const FILTER: { id: StatusFilter; label: string }[] = [
  { id: "offen", label: "Offen" },
  { id: "genehmigt", label: "Genehmigt" },
  { id: "abgelehnt", label: "Verworfen" },
  { id: "alle", label: "Alle" },
];

function AktionsCenter() {
  // Drafts are time-relative → load on the client only (no SSR mismatch).
  const [filter, setFilter] = useState<StatusFilter>("offen");
  const entwuerfe = useEntwuerfe();

  useEffect(() => {
    ladeEntwuerfe();
  }, []);

  const counts = useMemo(() => {
    const c = { offen: 0, genehmigt: 0, abgelehnt: 0 };
    for (const e of entwuerfe) c[e.status] += 1;
    return c;
  }, [entwuerfe]);

  const gefiltert = filter === "alle" ? entwuerfe : entwuerfe.filter((e) => e.status === filter);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        icon={Sparkles}
        badge={`${counts.offen} warten auf Freigabe`}
        title="Aktions-Center"
        description="GHASI AI erstellt professionelle Nachrichten-Entwürfe aus Live-Daten. Sie entscheiden – nichts wird automatisch versendet."
        right={
          <Link to="/posteingang">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <Inbox className="h-4 w-4" />
              Posteingang
            </Button>
          </Link>
        }
      />

      {/* Safety note */}
      <Card className="border-primary/30 bg-primary/5 shadow-sm">
        <CardContent className="flex items-start gap-3 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Sicherheit: </span>
            Die KI bereitet ausschließlich Entwürfe vor. Jede Nachricht erfordert Ihre ausdrückliche
            Freigabe (Genehmigen / Bearbeiten / Verwerfen) und wird im Aktivitätsprotokoll revisionssicher
            dokumentiert.
          </p>
        </CardContent>
      </Card>

      {/* Status filter */}
      <section className="grid grid-cols-3 gap-3">
        {(["offen", "genehmigt", "abgelehnt"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-card",
              filter === s ? "border-primary bg-primary/5 shadow-card" : "border-border/70 bg-card shadow-sm",
            )}
          >
            <p className="text-xs font-medium text-muted-foreground">
              {s === "offen" ? "Offen" : s === "genehmigt" ? "Genehmigt" : "Verworfen"}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{counts[s]}</p>
          </button>
        ))}
      </section>

      <div className="flex flex-wrap gap-1.5">
        {FILTER.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.id ? "border-primary bg-primary/5" : "border-border/70 bg-card hover:bg-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Drafts */}
      <section className="space-y-3">
        {gefiltert.map((e) => (
          <DraftCard key={e.id} entwurf={e} />
        ))}
        {gefiltert.length === 0 && (
          <Card className="border-dashed border-border/70 bg-muted/30">
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <p className="text-sm font-medium">Keine Entwürfe in diesem Status</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Sobald GHASI AI eine relevante Situation erkennt (Verspätung, fällige Wartung, offene
                Rechnung …), erscheinen hier neue Entwürfe zur Freigabe.
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Future integrations */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Vorbereitete Versandkanäle</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONEN.map((i) => {
            const Icon = i.icon;
            return (
              <Card key={i.id} className="border-border/70 shadow-sm">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{i.label}</p>
                      <Badge variant="outline" className="border-border bg-muted text-[10px] text-muted-foreground">
                        geplant
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{i.beschreibung}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
