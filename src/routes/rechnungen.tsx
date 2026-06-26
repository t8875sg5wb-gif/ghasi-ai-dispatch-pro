import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/rechnungen")({
  head: () => ({
    meta: [
      { title: "Rechnungen – GHASI AI" },
      { name: "description", content: "Abrechnung, Mahnwesen und offene Posten verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Rechnungen"
      description="Abrechnung, Mahnwesen und offene Posten verwalten."
      icon={FileText}
      features={[
    "Rechnungserstellung",
    "Sammelrechnungen",
    "Mahnwesen",
    "Offene Posten",
    "Zahlungseingänge",
    "Vorlagen",
      ]}
    />
  ),
});
