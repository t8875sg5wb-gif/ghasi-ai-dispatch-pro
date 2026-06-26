import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/kunden")({
  head: () => ({
    meta: [
      { title: "Kunden – GHASI AI" },
      { name: "description", content: "Auftraggeber, Kassen und Vertragspartner zentral verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Kunden"
      description="Auftraggeber, Kassen und Vertragspartner zentral verwalten."
      icon={Building2}
      features={[
    "Kundenstamm",
    "Verträge",
    "Konditionen",
    "Ansprechpartner",
    "Umsatzhistorie",
    "Abrechnungsdaten",
      ]}
    />
  ),
});
