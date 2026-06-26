import { createFileRoute } from "@tanstack/react-router";
import { Hospital } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/krankenhaeuser")({
  head: () => ({
    meta: [
      { title: "Krankenhäuser – GHASI AI" },
      { name: "description", content: "Kliniken, Stationen und Ansprechpartner verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Krankenhäuser"
      description="Kliniken, Stationen und Ansprechpartner verwalten."
      icon={Hospital}
      features={[
    "Klinik-Verzeichnis",
    "Stationen",
    "Ansprechpartner",
    "Anfahrtsdaten",
    "Rahmenverträge",
    "Transportvolumen",
      ]}
    />
  ),
});
