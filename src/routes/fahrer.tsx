import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/fahrer")({
  head: () => ({
    meta: [
      { title: "Fahrer – GHASI AI" },
      { name: "description", content: "Personal, Qualifikationen, Verfügbarkeiten und Schichten verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Fahrer"
      description="Personal, Qualifikationen, Verfügbarkeiten und Schichten verwalten."
      icon={Users}
      features={[
    "Personalakten",
    "Qualifikationen",
    "Schichtplanung",
    "Verfügbarkeiten",
    "Dokumente & Fristen",
    "Leistungsübersicht",
      ]}
    />
  ),
});
