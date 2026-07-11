import { createFileRoute } from "@tanstack/react-router";
import { Hospital, Droplets, Home, Building2 } from "lucide-react";

import { EinrichtungModul } from "@/components/einrichtungen/einrichtung-modul";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHero } from "@/components/enterprise/page-hero";

const einrichtungConfigs = {
  krankenhaeuser: {
    typ: "krankenhaus" as const,
    titel: "Krankenhäuser",
    einzahl: "Krankenhaus",
    beschreibung: "Kliniken, Fachbereiche, Ansprechpartner und Transporte.",
    icon: Hospital,
    idPrefix: "kh",
    
    kapazitaetLabel: "Betten",
  },
  dialysezentren: {
    typ: "dialyse" as const,
    titel: "Dialysezentren",
    einzahl: "Dialysezentrum",
    beschreibung: "Zentren, Schichtzeiten, Behandlungsplätze und Sammeltouren.",
    icon: Droplets,
    idPrefix: "dz",
    
    kapazitaetLabel: "Behandlungsplätze",
  },
  pflegeheime: {
    typ: "pflegeheim" as const,
    titel: "Pflegeheime",
    einzahl: "Pflegeheim",
    beschreibung: "Einrichtungen, Plätze, Ansprechpartner und Transporte.",
    icon: Home,
    idPrefix: "ph",
    
    kapazitaetLabel: "Plätze",
  },
};

type EinrichtungTab = keyof typeof einrichtungConfigs;

export const Route = createFileRoute("/einrichtungen")({
  validateSearch: (search: Record<string, unknown>): { tab: EinrichtungTab } => {
    const tab = search.tab;
    const gueltig =
      tab === "krankenhaeuser" || tab === "dialysezentren" || tab === "pflegeheime";
    return { tab: gueltig ? (tab as EinrichtungTab) : "krankenhaeuser" };
  },
  head: () => ({
    meta: [
      { title: "Einrichtungen – GHASI AI" },
      {
        name: "description",
        content:
          "Krankenhäuser, Dialysezentren und Pflegeheime zentral verwalten – Kontakte, Kapazitäten und Transporte.",
      },
    ],
  }),
  component: EinrichtungenHub,
});

function EinrichtungenHub() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const config = einrichtungConfigs[tab as EinrichtungTab];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        icon={Building2}
        badge="Einrichtungen"
        title="Einrichtungen"
        description="Krankenhäuser, Dialysezentren und Pflegeheime an einem Ort."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as EinrichtungTab } })}
      >
        <TabsList>
          <TabsTrigger value="krankenhaeuser">
            <Hospital className="mr-1.5 h-4 w-4" /> Krankenhäuser
          </TabsTrigger>
          <TabsTrigger value="dialysezentren">
            <Droplets className="mr-1.5 h-4 w-4" /> Dialysezentren
          </TabsTrigger>
          <TabsTrigger value="pflegeheime">
            <Home className="mr-1.5 h-4 w-4" /> Pflegeheime
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <EinrichtungModul key={tab} config={config} />
    </div>
  );
}
