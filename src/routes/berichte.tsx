import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/berichte")({
  head: () => ({
    meta: [
      { title: "Berichte – GHASI AI" },
      { name: "description", content: "Operative und finanzielle Reports auf Knopfdruck erstellen." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Berichte"
      description="Operative und finanzielle Reports auf Knopfdruck erstellen."
      icon={BarChart3}
      features={[
    "Standard-Reports",
    "Individuelle Berichte",
    "Zeiträume",
    "Export PDF/Excel",
    "Automatischer Versand",
    "Vorlagen",
      ]}
    />
  ),
});
