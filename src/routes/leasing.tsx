import { createFileRoute } from "@tanstack/react-router";
import { CarFront } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/leasing")({
  head: () => ({
    meta: [
      { title: "Leasing – GHASI AI" },
      { name: "description", content: "Leasingverträge, Raten und Laufzeiten im Blick behalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Leasing"
      description="Leasingverträge, Raten und Laufzeiten im Blick behalten."
      icon={CarFront}
      features={[
    "Leasingverträge",
    "Raten & Laufzeiten",
    "Restwerte",
    "Kündigungsfristen",
    "Anbieter",
    "Kostenvergleich",
      ]}
    />
  ),
});
