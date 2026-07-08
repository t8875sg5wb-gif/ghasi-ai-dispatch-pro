import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/lohn")({
  head: () => ({
    meta: [
      { title: "Lohn-Rechner – GHASI AI" },
      { name: "description", content: "Netto-, Arbeitgeberkosten- und Minijob-Näherung je Fahrer." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Lohn-Rechner (informativ)"
      description="Bereitet Netto, Arbeitgeberkosten und Minijob-Prüfung (556 €/Monat, 2026) je Fahrer vor. Die offizielle Lohnabrechnung erfordert zertifizierte Software oder einen Lohnservice."
      icon={Wallet}
      features={[
        "Beschäftigungsart je Fahrer: Minijob / Midijob / SV-pflichtig",
        "Brutto → Netto-Schätzung inkl. AG-Beiträge (Näherung)",
        "Monatsübersicht: Auszahlung Fahrer & Krankenkasse/Minijob-Zentrale",
        "PDF-Export je Monat",
      ]}
    />
  ),
});
