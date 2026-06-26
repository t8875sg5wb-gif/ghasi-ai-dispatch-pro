import { createFileRoute } from "@tanstack/react-router";
import { ShieldUser } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/administration")({
  head: () => ({
    meta: [
      { title: "Administration – GHASI AI" },
      { name: "description", content: "Benutzer, Rollen, Rechte und Systemkonfiguration verwalten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Administration"
      description="Benutzer, Rollen, Rechte und Systemkonfiguration verwalten."
      icon={ShieldUser}
      features={[
    "Benutzerverwaltung",
    "Rollen & Rechte",
    "Audit-Log",
    "Datensicherung",
    "API-Zugänge",
    "Systemstatus",
      ]}
    />
  ),
});
