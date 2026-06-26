import { createFileRoute } from "@tanstack/react-router";
import { Wrench } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/wartung")({
  head: () => ({
    meta: [
      { title: "Wartung – GHASI AI" },
      { name: "description", content: "Inspektionen, TÜV, Reparaturen und Servicehistorie verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Wartung"
      description="Inspektionen, TÜV, Reparaturen und Servicehistorie verwalten."
      icon={Wrench}
      features={[
    "Wartungsplaner",
    "TÜV & HU",
    "Reparaturen",
    "Servicehistorie",
    "Werkstätten",
    "Kostenübersicht",
      ]}
    />
  ),
});
