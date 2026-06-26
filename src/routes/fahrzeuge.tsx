import { createFileRoute } from "@tanstack/react-router";
import { Truck } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/fahrzeuge")({
  head: () => ({
    meta: [
      { title: "Fahrzeuge – GHASI AI" },
      { name: "description", content: "Flotte, Ausstattung, Status und Fahrzeugdokumente verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Fahrzeuge"
      description="Flotte, Ausstattung, Status und Fahrzeugdokumente verwalten."
      icon={Truck}
      features={[
    "Fahrzeugakten",
    "Ausstattung",
    "Verfügbarkeit",
    "Kilometerstand",
    "TÜV & Dokumente",
    "Kostenübersicht",
      ]}
    />
  ),
});
