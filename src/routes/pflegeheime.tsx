import { createFileRoute } from "@tanstack/react-router";
import { Home } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/pflegeheime")({
  head: () => ({
    meta: [
      { title: "Pflegeheime – GHASI AI" },
      { name: "description", content: "Einrichtungen, Bewohner und regelmäßige Transporte verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Pflegeheime"
      description="Einrichtungen, Bewohner und regelmäßige Transporte verwalten."
      icon={Home}
      features={[
    "Einrichtungen",
    "Bewohner",
    "Regeltransporte",
    "Ansprechpartner",
    "Verträge",
    "Tourenanbindung",
      ]}
    />
  ),
});
