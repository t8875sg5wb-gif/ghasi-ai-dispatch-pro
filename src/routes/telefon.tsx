import { createFileRoute } from "@tanstack/react-router";
import { Phone } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/telefon")({
  head: () => ({
    meta: [
      { title: "Telefon – GHASI AI" },
      { name: "description", content: "Integrierte Telefonie, Anrufannahme und Gesprächsprotokolle." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Telefon"
      description="Integrierte Telefonie, Anrufannahme und Gesprächsprotokolle."
      icon={Phone}
      features={[
    "Anrufannahme",
    "Rückrufliste",
    "Gesprächsnotizen",
    "Auftrag aus Anruf",
    "Anrufstatistik",
    "Voicemail",
      ]}
    />
  ),
});
