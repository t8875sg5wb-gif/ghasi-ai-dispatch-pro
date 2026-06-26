import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen – GHASI AI" },
      { name: "description", content: "Unternehmensdaten, Benachrichtigungen und Präferenzen." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Einstellungen"
      description="Unternehmensdaten, Benachrichtigungen und Präferenzen."
      icon={Settings}
      features={[
    "Unternehmensdaten",
    "Benachrichtigungen",
    "Darstellung",
    "Sprache & Region",
    "Integrationen",
    "Sicherheit",
      ]}
    />
  ),
});
