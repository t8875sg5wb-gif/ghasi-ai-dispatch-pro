import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Crown, Gauge, Lightbulb, LineChart, PieChart, BarChart3 } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CeoCockpit } from "@/components/analytics/ceo-cockpit-view";
import { ControlCenter } from "@/components/analytics/control-center-view";
import { InsightsPage } from "@/components/analytics/insights-view";
import { PrognosenPage } from "@/components/analytics/prognosen-view";
import { StatistikenPage } from "@/components/analytics/statistiken-view";
import { BerichtePage } from "@/components/analytics/berichte-view";

const TABS = [
  { id: "cockpit", label: "Cockpit", icon: Crown },
  { id: "control-center", label: "Control Center", icon: Gauge },
  { id: "insights", label: "KI-Insights", icon: Lightbulb },
  { id: "prognosen", label: "Prognosen", icon: LineChart },
  { id: "statistiken", label: "Statistiken", icon: PieChart },
  { id: "berichte", label: "Berichte", icon: BarChart3 },
] as const;

export type AnalyseTab = (typeof TABS)[number]["id"];
const TAB_IDS = TABS.map((t) => t.id) as readonly string[];

export const Route = createFileRoute("/ceo-cockpit")({
  validateSearch: (search: Record<string, unknown>): { tab: AnalyseTab } => {
    const tab =
      typeof search.tab === "string" && TAB_IDS.includes(search.tab) ? search.tab : "cockpit";
    return { tab: tab as AnalyseTab };
  },
  head: () => ({
    meta: [
      { title: "Analyse-Hub – GHASI AI" },
      {
        name: "description",
        content:
          "Zentraler Analyse-Hub: CEO Cockpit, Control Center, KI-Insights, Prognosen, Statistiken und Berichte an einem Ort.",
      },
    ],
  }),
  component: AnalyseHub,
});

function AnalyseHub() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in space-y-6">
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ to: "/ceo-cockpit", search: { tab: v as AnalyseTab } })}
      >
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="gap-1.5">
              <t.icon className="h-4 w-4" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === "cockpit" && <CeoCockpit />}
      {tab === "control-center" && <ControlCenter />}
      {tab === "insights" && <InsightsPage />}
      {tab === "prognosen" && <PrognosenPage />}
      {tab === "statistiken" && <StatistikenPage />}
      {tab === "berichte" && <BerichtePage />}
    </div>
  );
}
