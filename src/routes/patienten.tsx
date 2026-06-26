import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/patienten")({
  head: () => ({
    meta: [
      { title: "Patienten – GHASI AI" },
      { name: "description", content: "Patientenakten, Mobilität und Transportbedarf verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Patienten"
      description="Patientenakten, Mobilität und Transportbedarf verwalten."
      icon={HeartPulse}
      features={[
    "Patientenakten",
    "Mobilitätsgrad",
    "Wiederkehrende Fahrten",
    "Medizinische Hinweise",
    "Kostenträger",
    "Datenschutz",
      ]}
    />
  ),
});
