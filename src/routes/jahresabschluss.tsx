import { createFileRoute } from "@tanstack/react-router";
import { CheckSquare } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/jahresabschluss")({
  head: () => ({
    meta: [
      { title: "Jahresabschluss – GHASI AI" },
      { name: "description", content: "Steuerschätzung, Fristen und Jahresabschluss-Checkliste." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Jahresabschluss-Assistent"
      description="Geschätzte Einkommensteuer & Gewerbesteuer (§35 EStG Anrechnung), Aufbewahrungsfristen und eine Schritt-für-Schritt-Checkliste mit ELSTER-Übertragungswerten. Diese Angaben ersetzen keine steuerliche Beratung."
      icon={CheckSquare}
      features={[
        "Einkommensteuer-Schätzung 2026 & Gewerbesteuer (Hebesatz Minden 460 %)",
        "Fristen: ESt/EÜR 31.07. Folgejahr, GewSt- & USt-Jahreserklärung",
        "Aufbewahrungsfristen: 8 J. Belege, 10 J. Bücher, 6 J. Lohnkonten, 2 J. Arbeitszeit",
        "Checkliste mit vorbereiteten ELSTER-Werten",
      ]}
    />
  ),
});
