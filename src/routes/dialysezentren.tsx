import { createFileRoute } from "@tanstack/react-router";
import { Droplets } from "lucide-react";

import { EinrichtungModul } from "@/components/einrichtungen/einrichtung-modul";
import { DIALYSEZENTREN } from "@/lib/stammdaten";

export const Route = createFileRoute("/dialysezentren")({
  head: () => ({
    meta: [
      { title: "Dialysezentren – GHASI AI" },
      {
        name: "description",
        content: "Dialysezentren, Schichtzeiten und wiederkehrende Sammeltouren.",
      },
    ],
  }),
  component: () => (
    <EinrichtungModul
      config={{
        typ: "dialyse",
        titel: "Dialysezentren",
        einzahl: "Dialysezentrum",
        beschreibung: "Zentren, Schichtzeiten, Behandlungsplätze und Sammeltouren.",
        icon: Droplets,
        idPrefix: "dz",
        daten: DIALYSEZENTREN,
        kapazitaetLabel: "Behandlungsplätze",
      }}
    />
  ),
});
