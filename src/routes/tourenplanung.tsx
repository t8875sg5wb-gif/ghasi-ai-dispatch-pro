import { createFileRoute } from "@tanstack/react-router";
import { Route as RouteIcon } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/tourenplanung")({
  head: () => ({
    meta: [
      { title: "Tourenplanung – GHASI AI" },
      { name: "description", content: "Optimierte Routen, Schichten und intelligente Fahrzeugzuteilung." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Tourenplanung"
      description="Optimierte Routen, Schichten und intelligente Fahrzeugzuteilung."
      icon={RouteIcon}
      features={[
    "Routen-Optimierung",
    "Drag & Drop Planung",
    "Schichtmodelle",
    "Leerkilometer-Minimierung",
    "Kapazitätsplanung",
    "KI-Vorschläge",
      ]}
    />
  ),
});
