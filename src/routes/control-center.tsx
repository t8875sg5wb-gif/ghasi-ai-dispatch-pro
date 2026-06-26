import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Gauge,
  Euro,
  TrendingUp,
  Truck,
  UserCheck,
  Loader,
  HeartPulse,
  FileText,
  Activity,
  AlertTriangle,
  Wrench,
  Cpu,
  ArrowRight,
} from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { ExecutiveAnalysis } from "@/components/ai/executive-analysis";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  computeKpis,
  computeBusinessHealth,
  EUR,
  type HealthStufe,
} from "@/lib/ai-brain";

export const Route = createFileRoute("/control-center")({
  head: () => ({
    meta: [
      { title: "Control Center – GHASI AI" },
      {
        name: "description",
        content:
          "Executive Control Center mit Live-Geschäftskennzahlen, dynamischem Business Health Score und KI-Lageanalyse für Ihr Krankentransportunternehmen.",
      },
    ],
  }),
  component: ControlCenter,
});

const STUFE_TEXT: Record<HealthStufe, string> = {
  exzellent: "Exzellent",
  gut: "Gut",
  stabil: "Stabil",
  kritisch: "Kritisch",
};
const STUFE_COLOR: Record<HealthStufe, string> = {
  exzellent: "var(--chart-3)",
  gut: "var(--chart-2)",
  stabil: "var(--chart-4)",
  kritisch: "var(--destructive)",
};

function HealthGauge({ score, stufe }: { score: number; stufe: HealthStufe }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  const color = STUFE_COLOR[stufe];
  return (
    <div className="relative flex h-44 w-44 items-center justify-center">
      <svg className="h-44 w-44 -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--muted)" strokeWidth="12" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold tabular-nums">{score}</span>
        <span className="text-xs text-muted-foreground">von 100</span>
        <Badge className="mt-1 border-0" style={{ background: `${color}22`, color }}>
          {STUFE_TEXT[stufe]}
        </Badge>
      </div>
    </div>
  );
}

function ControlCenter() {
  const k = computeKpis();
  const health = computeBusinessHealth(k);

  const stats = [
    { label: "Umsatz heute", value: EUR(k.umsatzHeute), icon: Euro, tone: "primary" as const, hint: `Monat ${EUR(k.umsatzMonat)}` },
    { label: "Gewinn heute", value: EUR(k.gewinnHeute), icon: TrendingUp, tone: "success" as const, hint: `Marge ${k.margeProzent} %` },
    { label: "Laufende Transporte", value: String(k.laufendeTransporte), icon: Loader, tone: "warning" as const, hint: `${k.offeneTransporte} offen` },
    { label: "Patienten unterwegs", value: String(k.patientenUnterwegs), icon: HeartPulse, tone: "info" as const, hint: "aktuell betreut" },
    { label: "Fahrzeuge aktiv", value: `${k.aktiveFahrzeuge}`, icon: Truck, tone: "primary" as const, hint: `${k.freieFahrzeuge} frei` },
    { label: "Fahrer aktiv", value: `${k.aktiveFahrer}`, icon: UserCheck, tone: "accent" as const, hint: `${k.freieFahrer} frei` },
    { label: "Offene Rechnungen", value: String(k.offeneRechnungen), icon: FileText, tone: "warning" as const, hint: "zur Prüfung" },
    { label: "KI-Effizienz", value: `${k.aiEffizienz} %`, icon: Cpu, tone: "success" as const, hint: "Gesamtindex" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        icon={Gauge}
        badge="Echtzeit"
        title="Executive Control Center"
        description="Die zentrale Kommandozentrale: Live-Kennzahlen, Geschäftsgesundheit und KI-Lageanalyse auf einen Blick."
        right={
          <Button asChild variant="secondary" className="rounded-full">
            <Link to="/insights">
              KI-Insights <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {/* Business Health + Auslastung */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Business Health Score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <HealthGauge score={health.score} stufe={health.stufe} />
            <p className="text-center text-xs text-muted-foreground">
              Dynamisch berechnet aus Profitabilität, Auslastung, Pünktlichkeit, Zufriedenheit und Risiko.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Gesundheitsfaktoren</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {health.faktoren.map((f) => (
              <div key={f.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{f.label}</span>
                  <span className="text-muted-foreground">
                    {Math.round(f.wert)} / {f.max} · {f.beschreibung}
                  </span>
                </div>
                <Progress value={(f.wert / f.max) * 100} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Live KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </section>

      {/* Operative Signale */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Link to="/warnungen" className="group">
          <Card className="h-full border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold tabular-nums">{k.kritischeAlarme}</p>
                <p className="text-xs text-muted-foreground">Kritische Alarme · zum Alert-Center</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/wartung" className="group">
          <Card className="h-full border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/20 text-warning">
                <Wrench className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold tabular-nums">{k.wartungOffen}</p>
                <p className="text-xs text-muted-foreground">Wartung offen · zur Werkstatt</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/prognosen" className="group">
          <Card className="h-full border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-info/15 text-info">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold tabular-nums">{k.flottenauslastung} %</p>
                <p className="text-xs text-muted-foreground">Flottenauslastung · zu den Prognosen</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </section>

      <ExecutiveAnalysis />
    </div>
  );
}
