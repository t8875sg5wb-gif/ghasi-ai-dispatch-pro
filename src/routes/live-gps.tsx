import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/live-gps")({
  head: () => ({
    meta: [
      { title: "Live-GPS – GHASI AI" },
      { name: "description", content: "Standort aller Fahrzeuge in Echtzeit auf der Karte verfolgen." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Live-GPS"
      description="Standort aller Fahrzeuge in Echtzeit auf der Karte verfolgen."
      icon={MapPin}
      features={[
    "Live-Karte",
    "Geofencing",
    "Ankunftsprognosen",
    "Routen-Historie",
    "Statusübersicht",
    "Alarme",
      ]}
    />
  ),
});
