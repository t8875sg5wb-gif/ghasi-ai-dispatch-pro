import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Crown,
  Euro,
  TrendingUp,
  CalendarClock,
  Route as RouteIcon,
  Truck,
  UserCheck,
  FileText,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Fuel,
  Gauge,
  Sun,
  Moon,
  ShieldAlert,
  Lightbulb,
} from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { ExecutiveAnalysis } from "@/components/ai/executive-analysis";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useOrders } from "@/lib/orders-store";
import { useDrivers } from "@/lib/drivers-store";
import { useInvoices } from "@/lib/invoices-store";
import { computeKpis, computeBusinessHealth, EUR } from "@/lib/ai-brain";
import {
  computeCashflowForecast,
  computeCapacity,
  computeEmptyMileage,
  computeCeoRecommendations,
  computeRiskAlerts,
  profitProFahrer,
  buildCeoBriefing,
  buildEveningSummary,
  type CeoWirkung,
  type RisikoStufe,
} from "@/lib/ceo-intelligence";

export const Route = createFileRoute("/ceo-cockpit")({
  head: () => ({
    meta: [
      { title: "CEO Cockpit – GHASI AI" },
      {
        name: "description",
        content:
          "Der digitale Geschäftsführer: Umsatz- & Gewinnprognosen, Cashflow, Leerkilometer, freie Kapazität, KI-Empfehlungen und Geschäftsrisiken auf einen Blick.",
      },
    ],
  }),
  component: CeoCockpit,
});

const WIRKUNG_BADGE: Record<CeoWirkung, string> = {
  hoch: "border-destructive/30 bg-destructive/10 text-destructive",
  mittel: "border-warning/30 bg-warning/10 text-warning",
  niedrig: "border-info/30 bg-info/10 text-info",
};
const RISIKO_BADGE: Record<RisikoStufe, string> = {
  kritisch: "border-destructive/30 bg-destructive/10 text-destructive",
  hoch: "border-warning/30 bg-warning/10 text-warning",
  mittel: "border-info/30 bg-info/10 text-info",
};

function CeoCockpit() {
  // Trigger live hydration of the shared mirrors (orders/drivers/invoices) so
  // all deterministic CEO computations run on the persisted business data.
  useOrders();
  useDrivers();
  useInvoices();

  const kpis = computeKpis();
  const health = computeBusinessHealth(kpis);
  const cashflow = computeCashflowForecast(kpis);
  const cap = computeCapacity(kpis);
  const empty = computeEmptyMileage();
  const recs = computeCeoRecommendations();
  const risks = computeRiskAlerts();
  const topFahrer = profitProFahrer().slice(0, 4);
  const briefing = buildCeoBriefing();
  const abend = buildEveningSummary();

  const stats = [
    {
      label: "Umsatz heute",
      value: EUR(kpis.umsatzHeute),
      icon: Euro,
      tone: "primary" as const,
      hint: `Monat ${EUR(kpis.umsatzMonat)}`,
    },
    {
      label: "Erwarteter Gewinn",
      value: EUR(kpis.gewinnHeute),
      icon: TrendingUp,
      tone: "success" as const,
      hint: `Marge ${kpis.margeProzent} %`,
    },
    {
      label: "Geplante Fahrten",
      value: String(kpis.laufendeTransporte + kpis.offeneTransporte),
      icon: RouteIcon,
      tone: "info" as const,
      hint: `${kpis.offeneTransporte} offen`,
    },
    {
      label: "Freie Kapazität",
      value: `+${cap.zusaetzlicheAuftraege}`,
      icon: UserCheck,
      tone: "accent" as const,
      hint: `${EUR(cap.potenzialUmsatz)} Potenzial`,
    },
    {
      label: "Leerkilometer",
      value: `${empty.anteilProzent} %`,
      icon: Fuel,
      tone: "warning" as const,
      hint: `${empty.leerKm} km · ${EUR(empty.ersparnisTag)}/Tag`,
    },
    {
      label: "Fahrzeuge aktiv",
      value: String(kpis.aktiveFahrzeuge),
      icon: Truck,
      tone: "primary" as const,
      hint: `${kpis.freieFahrzeuge} frei`,
    },
    {
      label: "Offene Rechnungen",
      value: String(kpis.offeneRechnungen),
      icon: FileText,
      tone: "warning" as const,
      hint: "zur Prüfung",
    },
    {
      label: "Health Score",
      value: `${health.score}`,
      icon: Gauge,
      tone: "success" as const,
      hint: health.stufe,
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        icon={Crown}
        badge="Digitaler Geschäftsführer"
        title="CEO Cockpit"
        description="GHASI AI führt Ihr Unternehmen mit: Prognosen, Cashflow, Kapazität, Leerkilometer, Empfehlungen und Risiken – jede Empfehlung mit Begründung und finanzieller Wirkung."
        right={
          <Badge className="border-0 bg-white/15 text-primary-foreground">Nur Empfehlungen</Badge>
        }
      />

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </section>

      {/* Tägliche Briefings */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <Sun className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">Morgen-Briefing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {briefing.map((z, i) => (
              <p key={i} className="flex gap-2 text-sm leading-snug text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                <span>{z}</span>
              </p>
            ))}
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/15 text-info">
              <Moon className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">Abend-Zusammenfassung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {abend.map((z, i) => (
              <p key={i} className="flex gap-2 text-sm leading-snug text-muted-foreground">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
                <span>{z}</span>
              </p>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Cashflow-Prognose */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarClock className="h-4 w-4" />
          </span>
          <CardTitle className="text-base">Umsatz-, Gewinn- & Cashflow-Prognose</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cashflow.map((c) => (
            <div key={c.tage} className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{EUR(c.umsatz)}</p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p className="flex justify-between">
                  <span>Gewinn</span>
                  <span className="font-semibold text-success">{EUR(c.gewinn)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Ausgaben</span>
                  <span>{EUR(c.ausgaben)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Cashflow</span>
                  <span className={c.cashflow >= 0 ? "text-success" : "text-destructive"}>
                    {EUR(c.cashflow)}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Empfehlungen + Risiken */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Lightbulb className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">KI-Empfehlungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aktuell keine dringenden Empfehlungen – der Betrieb läuft rund.
              </p>
            )}
            {recs.map((r) => (
              <Link
                key={r.id}
                to={r.to}
                className="block rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{r.titel}</p>
                  <Badge variant="outline" className={WIRKUNG_BADGE[r.wirkung]}>
                    {r.wirkung}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{r.warum}</p>
                <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-success">
                  <Sparkles className="h-3 w-3" /> {r.impact}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">Geschäftsrisiken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {risks.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine akuten Geschäftsrisiken erkannt.</p>
            )}
            {risks.map((r) => (
              <Link
                key={r.id}
                to={r.to}
                className="block rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    {r.titel}
                  </p>
                  <Badge variant="outline" className={RISIKO_BADGE[r.stufe]}>
                    {r.stufe}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{r.detail}</p>
                <p className="mt-1.5 text-xs font-semibold text-muted-foreground">{r.impact}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* Fahrer-Performance */}
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
              <UserCheck className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">Fahrer-Performance</CardTitle>
          </div>
          <Link
            to="/fahrer"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Alle Fahrer <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {topFahrer.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Fahrerdaten geladen.</p>
          )}
          {topFahrer.map((f) => (
            <div key={f.fahrer.id}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium">{f.fahrer.name}</span>
                <span className="text-muted-foreground">
                  {f.effizienz}/100 · {EUR(f.gewinn)} · {f.gewinnProKm} €/km
                </span>
              </div>
              <Progress value={f.effizienz} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      <ExecutiveAnalysis />
    </div>
  );
}
