import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Workflow, ShieldCheck, ArrowRight, CheckCircle2, Pause, Play } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/protokoll";
import {
  INITIAL_AUTOMATIONEN,
  AUTOMATION_KATEGORIE_META,
  AUTOMATION_STATUS_META,
  offeneFreigabenGesamt,
  type Automation,
  type AutomationStatus,
} from "@/lib/automation";

export const Route = createFileRoute("/automatisierung")({
  head: () => ({
    meta: [
      { title: "Automatisierung – GHASI AI" },
      { name: "description", content: "Wiederkehrende Aufgaben, Abrechnung, Wartung und Erinnerungen – nichts wird ohne Freigabe ausgeführt." },
    ],
  }),
  component: AutomationPage,
});

function AutomationPage() {
  const [autos, setAutos] = useState<Automation[]>(INITIAL_AUTOMATIONEN);
  const aktiv = autos.filter((a) => a.status === "aktiv").length;
  const freigaben = offeneFreigabenGesamt(autos);

  const toggle = (id: string) => {
    setAutos((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        const next: AutomationStatus = a.status === "aktiv" ? "pausiert" : "aktiv";
        toast.success(`„${a.name}" ${next === "aktiv" ? "aktiviert" : "pausiert"}`);
        logActivity({
          bereich: "Automatisierung",
          aktion: next === "aktiv" ? "Aktiviert" : "Pausiert",
          beschreibung: `Automatisierung „${a.name}" ${next === "aktiv" ? "aktiviert" : "pausiert"}`,
          entitaet: a.id,
        });
        return { ...a, status: next };
      }),
    );
  };

  const freigeben = (a: Automation) => {
    toast.success("Entwürfe freigegeben", { description: a.vorschlag });
    logActivity({
      bereich: "Automatisierung",
      aktion: "Freigabe",
      beschreibung: `Entwürfe aus „${a.name}" freigegeben`,
      entitaet: a.id,
    });
    setAutos((prev) => prev.map((x) => (x.id === a.id ? { ...x, offeneFreigaben: 0 } : x)));
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Automatisierungs-Center"
        description="Wiederkehrende Abrechnungen, Wartungen, Patiententransporte, Berichte und Erinnerungen. GHASI AI bereitet alles vor – ausgeführt wird nur nach Ihrer Freigabe."
        icon={Workflow}
        badge="Automation"
      />

      <Card className="border-success/30 bg-success/5 shadow-sm">
        <CardContent className="flex items-center gap-3 py-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
          <p className="text-sm">
            <span className="font-semibold">Sicherheit:</span> Keine Automatisierung versendet oder bucht etwas automatisch.
            Jeder Lauf erzeugt Entwürfe, die manuell bestätigt werden müssen.
          </p>
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Automatisierungen" value={`${autos.length}`} icon={Workflow} tone="primary" />
        <StatCard label="Aktiv" value={`${aktiv}`} icon={Play} tone="success" />
        <StatCard label="Pausiert" value={`${autos.length - aktiv}`} icon={Pause} tone="warning" />
        <StatCard label="Offene Freigaben" value={`${freigaben}`} icon={CheckCircle2} tone="accent" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {autos.map((a) => {
          const kat = AUTOMATION_KATEGORIE_META[a.kategorie];
          const st = AUTOMATION_STATUS_META[a.status];
          const KatIcon = kat.icon;
          return (
            <Card key={a.id} className="border-border/70 shadow-card">
              <CardHeader className="space-y-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", kat.badge)}>
                      <KatIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-semibold">{a.name}</CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.beschreibung}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn("shrink-0 text-[10px]", st.badge)}>
                    {st.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className={cn("text-[10px]", kat.badge)}>{kat.label}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{a.rhythmus}</Badge>
                  <Badge variant="outline" className="text-[10px]">Nächster Lauf: {a.naechsteAusfuehrung}</Badge>
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Vorbereiteter Vorschlag</p>
                  <p className="mt-0.5 text-sm">{a.vorschlag}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => toggle(a.id)}>
                    {a.status === "aktiv" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    {a.status === "aktiv" ? "Pausieren" : "Aktivieren"}
                  </Button>
                  <div className="flex items-center gap-2">
                    {a.offeneFreigaben > 0 && (
                      <Badge variant="outline" className="border-accent/30 bg-accent/10 text-[10px] text-accent">
                        {a.offeneFreigaben} Freigabe(n)
                      </Badge>
                    )}
                    <Button asChild variant="ghost" size="sm" className="rounded-full text-primary">
                      <Link to={a.to}>
                        Öffnen <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    {a.offeneFreigaben > 0 && (
                      <Button size="sm" className="rounded-full" onClick={() => freigeben(a)}>
                        Freigeben
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
