import { TrendingUp, Gauge, Users, Wrench, Fuel, CalendarRange, LineChart } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { SchaetzungBadge } from "@/components/ui/schaetzung-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ForecastAreaChart,
  ForecastBarChart,
  ForecastLineChart,
} from "@/components/enterprise/forecast-charts";
import { computePrognosen, EUR } from "@/lib/ai-brain";
import { useOrders } from "@/lib/orders-store";
import { useDrivers } from "@/lib/drivers-store";
import { useInvoices } from "@/lib/invoices-store";

function ChartCard({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: typeof TrendingUp;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function PrognosenPage() {
  useOrders();
  useDrivers();
  useInvoices();
  const p = computePrognosen();

  const stats = [
    {
      label: "Umsatz diese Woche",
      value: EUR(p.zusammenfassung.umsatzWocheGesamt),
      icon: TrendingUp,
      tone: "primary" as const,
      hint: "Prognose",
    },
    {
      label: "Engpasstag",
      value: p.zusammenfassung.erwarteterEngpassTag,
      icon: CalendarRange,
      tone: "warning" as const,
      hint: "höchster Bedarf",
    },
    {
      label: "Fahrer-Lücke (Spitze)",
      value: `${p.zusammenfassung.fahrerLueckeSpitze}`,
      icon: Users,
      tone: "accent" as const,
      hint: "zusätzlich nötig",
    },
    {
      label: "Wartungen 30 Tage",
      value: `${p.zusammenfassung.wartungenNaechste30Tage}`,
      icon: Wrench,
      tone: "info" as const,
      hint: "geplant",
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        icon={LineChart}
        badge="Predictive AI"
        title="Prognosen & Vorhersagen"
        description="GHASI AI prognostiziert Umsatz, Auslastung, Personal-, Wartungs- und Kraftstoffbedarf sowie saisonale Nachfrage."
      />

      <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
        <SchaetzungBadge
          label="Annahme"
          hinweis="Alle Prognosewerte sind modellhafte Hochrechnungen aus aktuellen Betriebsdaten, Wochentags- und Saisonprofilen sowie – falls keine echten Werte vorliegen – hinterlegten Annahmen (z. B. Basisumsatz). Keine garantierten Ist-Zahlen."
        />
        <span>Prognosen sind Schätzungen auf Basis von Betriebsdaten und Annahmen – keine garantierten Ist-Werte.</span>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </section>


      <section className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Umsatzprognose · Woche"
          icon={TrendingUp}
          tone="bg-primary/10 text-primary"
        >
          <ForecastAreaChart data={p.umsatzWoche} unit="€" />
        </ChartCard>
        <ChartCard
          title="Umsatzprognose · Monat"
          icon={CalendarRange}
          tone="bg-success/15 text-success"
        >
          <ForecastAreaChart data={p.umsatzMonat} unit="€" color="var(--chart-3)" />
        </ChartCard>
        <ChartCard title="Auslastungsprognose" icon={Gauge} tone="bg-info/15 text-info">
          <ForecastBarChart data={p.auslastungWoche} unit="%" color="var(--chart-2)" />
        </ChartCard>
        <ChartCard
          title="Fahrerbedarf vs. Verfügbarkeit"
          icon={Users}
          tone="bg-accent/15 text-accent"
        >
          <ForecastLineChart data={p.fahrerbedarf} />
        </ChartCard>
        <ChartCard title="Wartungsbedarf" icon={Wrench} tone="bg-warning/20 text-warning">
          <ForecastBarChart data={p.wartungsbedarf} color="var(--chart-4)" />
        </ChartCard>
        <ChartCard title="Kraftstoffbedarf" icon={Fuel} tone="bg-warning/20 text-warning">
          <ForecastBarChart data={p.kraftstoff} unit="l" color="var(--chart-4)" />
        </ChartCard>
        <ChartCard
          title="Saisonale Nachfrage (Index)"
          icon={LineChart}
          tone="bg-primary/10 text-primary"
        >
          <ForecastAreaChart data={p.saisonNachfrage} unit="Tsd. €" color="var(--chart-5)" />
        </ChartCard>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Prognosen basieren auf aktuellen Betriebsdaten und Nachfrageprofilen. GHASI AI gibt
        Empfehlungen – Entscheidungen treffen Sie.
      </p>
    </div>
  );
}
