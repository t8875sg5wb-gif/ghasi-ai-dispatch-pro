import { createFileRoute } from "@tanstack/react-router";
import { PieChart } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/statistiken")({
  head: () => ({
    meta: [
      { title: "Statistiken – GHASI AI" },
      { name: "description", content: "Kennzahlen, Trends und Analysen im Zeitverlauf auswerten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Statistiken"
      description="Kennzahlen, Trends und Analysen im Zeitverlauf auswerten."
      icon={PieChart}
      features={[
    "KPI-Dashboards",
    "Trendanalysen",
    "Auslastung",
    "Umsatzentwicklung",
    "Vergleiche",
    "Prognosen",
      ]}
    />
  ),
});
