import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { PlaceholderPage } from "@/components/placeholder-page";

export const Route = createFileRoute("/euer")({
  head: () => ({
    meta: [
      { title: "EÜR – GHASI AI" },
      { name: "description", content: "Einnahmen-Überschuss-Rechnung als Vorbereitung für ELSTER." },
    ],
  }),
  component: () => (
    <PlaceholderPage
      title="Einnahmen-Überschuss-Rechnung (EÜR)"
      description="Aggregiert bezahlte Rechnungen (Zufluss) und Ausgaben (Abfluss) je Jahr nach Anlage-EÜR-Kategorien. Übertragung ans Finanzamt erfolgt über ELSTER."
      icon={ScrollText}
      features={[
        "Umsätze aus bezahlten Rechnungen nach Zahlungsdatum (§11 EStG)",
        "Ausgaben je Kategorie aus dem Ausgaben-Modul",
        "Monatsaufstellung & Jahreswähler",
        "PDF-Export der vollständigen EÜR",
      ]}
    />
  ),
});
