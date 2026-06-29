import { createFileRoute } from "@tanstack/react-router";
import { Home } from "lucide-react";

import { EinrichtungModul } from "@/components/einrichtungen/einrichtung-modul";
import { PFLEGEHEIME } from "@/lib/stammdaten";

export const Route = createFileRoute("/pflegeheime")({
  head: () => ({
    meta: [
      { title: "Pflegeheime – GHASI AI" },
      {
        name: "description",
        content: "Pflegeeinrichtungen, Bewohner-Transporte und Ansprechpartner.",
      },
    ],
  }),
  component: () => (
    <EinrichtungModul
      config={{
        typ: "pflegeheim",
        titel: "Pflegeheime",
        einzahl: "Pflegeheim",
        beschreibung: "Einrichtungen, Plätze, Ansprechpartner und Transporte.",
        icon: Home,
        idPrefix: "ph",
        daten: PFLEGEHEIME,
        kapazitaetLabel: "Plätze",
      }}
    />
  ),
});
