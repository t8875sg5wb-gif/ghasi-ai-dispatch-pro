import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/versicherungen")({
  head: () => ({
    meta: [
      { title: "Versicherungen – GHASI AI" },
      { name: "description", content: "Policen, Fristen und Schadensfälle der Flotte verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Versicherungen"
      description="Policen, Fristen und Schadensfälle der Flotte verwalten."
      icon={ShieldCheck}
      features={[
    "Policen-Verwaltung",
    "Fristen & Erinnerungen",
    "Schadensfälle",
    "Beiträge",
    "Dokumente",
    "Versicherer",
      ]}
    />
  ),
});
