import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PieChart, TrendingUp, Activity, Truck, Users } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ForecastAreaChart, ForecastBarChart } from "@/components/enterprise/forecast-charts";
import { computePrognosen, computeKpis, type ForecastPoint } from "@/lib/ai-brain";
import { INITIAL_AUFTRAEGE, TRANSPORTARTEN } from "@/lib/auftraege";
import { computeFinanzKpis, EUR } from "@/lib/finance";

export const Route = createFileRoute("/statistiken")({
  head: () => ({
    meta: [
      { title: "Statistiken – GHASI AI" },
      { name: "description", content: "Kennzahlen, Trends und Analysen im Zeitverlauf – Umsatz, Auslastung und Transporte." },
    ],
  }),
  component: StatistikenPage,
});

function StatistikenPage() {
  const prognose = useMemo(() => computePrognosen(), []);
  const kpis = useMemo(() => computeKpis(), []);
  const finanz = useMemo(() => computeFinanzKpis(), []);

  const transportVerteilung: ForecastPoint[] = useMemo(
    () =>
      TRANSPORTARTEN.map((art) => ({
        label: art.replace("transport", "tr."),
        prognose: INITIAL_AUFTRAEGE.filter((a) => a.transportart === art).length,
      })),
    [],
  );

  const kostenVerteilung: ForecastPoint[] = useMemo(
    () => [
      { label: "Fahrzeug", prognose: finanz.kosten.fahrzeugkosten },
      { label: "Kraftstoff", prognose: finanz.kosten.kraftstoffkosten },
      { label: "Wartung", prognose: finanz.kosten.wartungskosten },
      { label: "Fahrer", prognose: finanz.kosten.fahrerkosten },
      { label: "Leasing", prognose: finanz.kosten.leasingkosten },
    ],
    [finanz],
  );

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Statistiken"
        description="Kennzahlen, Trends und Analysen im Zeitverlauf – live aus Betrieb und Finanzen aggregiert."
        icon={PieChart}
        badge="Business Intelligence"
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Umsatz/Monat" value={EUR(finanz.umsatzMonat)} icon={TrendingUp} tone="primary" />
        <StatCard label="Flottenauslastung" value={`${kpis.flottenauslastung} %`} icon={Truck} tone="info" />
        <StatCard label="Fahrerauslastung" value={`${kpis.fahrerauslastung} %`} icon={Users} tone="accent" />
        <StatCard label="Pünktlichkeit" value={`${kpis.durchschnittPuenktlichkeit} %`} icon={Activity} tone="success" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Umsatzentwicklung (Woche)</CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastAreaChart data={prognose.umsatzWoche} unit="€" />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Auslastung (Woche)</CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastBarChart data={prognose.auslastungWoche} unit="%" color="var(--chart-2)" />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Transporte nach Art</CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastBarChart data={transportVerteilung} color="var(--chart-4)" />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Kostenverteilung (Monat)</CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastBarChart data={kostenVerteilung} unit="€" color="var(--chart-5)" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
