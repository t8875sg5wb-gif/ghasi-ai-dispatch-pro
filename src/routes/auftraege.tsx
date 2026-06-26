import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/auftraege")({
  head: () => ({
    meta: [
      { title: "Aufträge – GHASI AI" },
      { name: "description", content: "Alle Krankentransporte erfassen, disponieren und in Echtzeit verfolgen." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Aufträge"
      description="Alle Krankentransporte erfassen, disponieren und in Echtzeit verfolgen."
      icon={ClipboardList}
      features={[
    "Auftragserfassung",
    "Status-Pipeline",
    "Wiederkehrende Fahrten",
    "Kassen-Abrechnung",
    "Prioritäten & SLA",
    "Dokumenten-Upload",
      ]}
    />
  ),
});
