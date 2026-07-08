import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance-Cockpit – GHASI AI" },
      { name: "description", content: "Fristen, Nachweise und Vollständigkeit für Schiene-A-Krankenfahrten." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Compliance-Cockpit (Schiene A)"
      description="Wiederkehrende Pflichten mit Fristen, Status und Anleitung – nur Schiene-A-relevant (keine KTW-/Rettungssanitäter-Themen). Plus Vollständigkeits-Prüfer „Was fehlt noch?“."
      icon={ClipboardCheck}
      features={[
        "TÜV je Fahrzeug, Versicherungserneuerungen, Kfz-Haftpflicht-Mindestdeckung",
        "P-Schein, Führungszeugnis, SV-Ausweis & Steuer-ID je Fahrer",
        "BG Verkehr, Gesundheitsamt-Hygiene, DSGVO-Basics, §133-SGB-V-Voraussetzungen",
        "Vollständigkeits-Prüfer & Zahlungsübersicht (offen/überfällig, anstehende Zahlungen)",
      ]}
    />
  ),
});
