import { createFileRoute } from "@tanstack/react-router";
import { Calculator } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/buchhaltung")({
  head: () => ({
    meta: [
      { title: "Buchhaltung – GHASI AI" },
      { name: "description", content: "Einnahmen, Ausgaben und betriebswirtschaftliche Auswertung." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Buchhaltung"
      description="Einnahmen, Ausgaben und betriebswirtschaftliche Auswertung."
      icon={Calculator}
      features={[
    "Einnahmen & Ausgaben",
    "Kostenstellen",
    "BWA",
    "DATEV-Export",
    "Kassenbuch",
    "Auswertungen",
      ]}
    />
  ),
});
