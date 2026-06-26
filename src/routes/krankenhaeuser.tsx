import { createFileRoute } from "@tanstack/react-router";
import { Hospital } from "lucide-react";

import { EinrichtungModul } from "@/components/einrichtungen/einrichtung-modul";
import { KRANKENHAEUSER } from "@/lib/stammdaten";

export const Route = createFileRoute("/krankenhaeuser")({
  head: () => ({
    meta: [
      { title: "Krankenhäuser – GHASI AI" },
      { name: "description", content: "Kliniken, Fachbereiche und Anfahrtshinweise zentral verwalten." },
    ],
  }),
  component: () => (
    <EinrichtungModul
      config={{
        typ: "krankenhaus",
        titel: "Krankenhäuser",
        einzahl: "Krankenhaus",
        beschreibung: "Kliniken, Fachbereiche, Ansprechpartner und Transporte.",
        icon: Hospital,
        idPrefix: "kh",
        daten: KRANKENHAEUSER,
        kapazitaetLabel: "Betten",
      }}
    />
  ),
});
