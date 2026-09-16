import { PieChart, TrendingUp, Activity, Truck, Users } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { SchaetzungBadge } from "@/components/ui/schaetzung-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ForecastAreaChart, ForecastBarChart } from "@/components/enterprise/forecast-charts";
import { computePrognosen, computeKpis, type ForecastPoint } from "@/lib/ai-brain";
import { INITIAL_AUFTRAEGE, TRANSPORTARTEN } from "@/lib/auftraege";
import { computeFinanzKpis, EUR } from "@/lib/finance";
import { useOrders } from "@/lib/orders-store";
import { useDrivers } from "@/lib/drivers-store";
import { useInvoices } from "@/lib/invoices-store";
import { useVehicles } from "@/lib/vehicles-store";
import { Skeleton } from "@/components/ui/skeleton";

export function StatistikenPage() {
  // Live-Hydration, damit die Kennzahlen bei jeder Datenänderung neu berechnet werden.
  const ordersQ = useOrders();
  const driversQ = useDrivers();
  const invoicesQ = useInvoices();
  const vehiclesQ = useVehicles();
  // Bis zur ersten Hydration stehen in den Legacy-Spiegeln Demo-Fuhrpark-Daten
  // statt echter Werte – ohne Sperre zeigt die erste Sekunde falsche Zahlen
  // (z. B. Umsatz 0 € statt 9.610 €, Flottenauslastung 25 % statt 0 %).
  const bereit =
    ordersQ.data !== undefined &&
    driversQ.data !== undefined &&
    invoicesQ.data !== undefined &&
    vehiclesQ.data !== undefined;

  const kpis = computeKpis({
    auftraege: ordersQ.data ?? [],
    fahrer: driversQ.data ?? [],
    fahrzeuge: vehiclesQ.data ?? [],
    rechnungen: invoicesQ.data ?? [],
  });
  const prognose = computePrognosen(kpis, {
    fahrer: driversQ.data ?? [],
    fahrzeuge: vehiclesQ.data ?? [],
  });
  const finanz = computeFinanzKpis(invoicesQ.data ?? [], {
    fahrer: driversQ.data ?? [],
    fahrzeuge: vehiclesQ.data ?? [],
    auftraege: ordersQ.data ?? [],
    rechnungen: invoicesQ.data ?? [],
  });

  if (!bereit) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHero
          title="Statistiken"
          description="Kennzahlen, Trends und Analysen im Zeitverlauf – live aus Betrieb und Finanzen aggregiert."
          icon={PieChart}
          badge="Business Intelligence"
        />
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </section>
        <section className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </section>
      </div>
    );
  }

  const transportVerteilung: ForecastPoint[] = TRANSPORTARTEN.map((art) => ({
    label: art.replace("transport", "tr."),
    prognose: INITIAL_AUFTRAEGE.filter((a) => a.transportart === art).length,
  }));

  const kostenVerteilung: ForecastPoint[] = [
    { label: "Fahrzeug", prognose: finanz.kosten.fahrzeugkosten },
    { label: "Kraftstoff", prognose: finanz.kosten.kraftstoffkosten },
    { label: "Wartung", prognose: finanz.kosten.wartungskosten },
    { label: "Fahrer", prognose: finanz.kosten.fahrerkosten },
    { label: "Leasing", prognose: finanz.kosten.leasingkosten },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Statistiken"
        description="Kennzahlen, Trends und Analysen im Zeitverlauf – live aus Betrieb und Finanzen aggregiert."
        icon={PieChart}
        badge="Business Intelligence"
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Umsatz/Monat"
          value={EUR(finanz.umsatzMonat)}
          icon={TrendingUp}
          tone="primary"
        />
        <StatCard
          label="Flottenauslastung"
          value={`${kpis.flottenauslastung} %`}
          icon={Truck}
          tone="info"
        />
        <StatCard
          label="Fahrerauslastung"
          value={`${kpis.fahrerauslastung} %`}
          icon={Users}
          tone="accent"
        />
        <StatCard
          label="Pünktlichkeit"
          value={`${kpis.durchschnittPuenktlichkeit} %`}
          icon={Activity}
          tone="success"
        />
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
            <CardTitle className="flex items-center gap-2 text-base">
              Kostenverteilung (Monat)
              <SchaetzungBadge hinweis="Kraftstoff-, Fahrzeug- und Fahrerkosten sind Hochrechnungen aus Annahmen (Kraftstoffpreis, Arbeitstage/Monat – in den Einstellungen anpassbar). Sobald echte Belege im Ausgaben-Modul vorliegen, wird der echte Kraftstoffwert verwendet." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ForecastBarChart data={kostenVerteilung} unit="€" color="var(--chart-5)" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
