import { createFileRoute } from "@tanstack/react-router";
import { Droplets } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/dialysezentren")({
  head: () => ({
    meta: [
      { title: "Dialysezentren – GHASI AI" },
      { name: "description", content: "Dialysepartner, Termine und wiederkehrende Fahrten verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Dialysezentren"
      description="Dialysepartner, Termine und wiederkehrende Fahrten verwalten."
      icon={Droplets}
      features={[
    "Zentren-Verzeichnis",
    "Behandlungszeiten",
    "Sammeltouren",
    "Wiederkehrende Termine",
    "Kapazitäten",
    "Abrechnung",
      ]}
    />
  ),
});
