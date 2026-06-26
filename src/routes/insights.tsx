import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Lightbulb,
  TrendingUp,
  Coins,
  Gauge,
  Users,
  Truck,
  CalendarClock,
  LineChart,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { ExecutiveAnalysis } from "@/components/ai/executive-analysis";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeInsights, type Insight, type InsightKategorie, type InsightWirkung } from "@/lib/ai-brain";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "KI-Insights – GHASI AI" },
      {
        name: "description",
        content:
          "Executive Insights von GHASI AI: Sparpotenziale, Gewinnchancen, Auslastung, Fahrer- und Flottenoptimierung – jede Empfehlung mit Begründung.",
      },
    ],
  }),
  component: InsightsPage,
});

const KAT_META: Record<InsightKategorie, { label: string; icon: LucideIcon; tone: string }> = {
  kosten: { label: "Kosten", icon: Coins, tone: "bg-warning/20 text-warning" },
  gewinn: { label: "Gewinn", icon: TrendingUp, tone: "bg-success/15 text-success" },
  auslastung: { label: "Auslastung", icon: Gauge, tone: "bg-primary/10 text-primary" },
  fahrer: { label: "Fahrer", icon: Users, tone: "bg-accent/15 text-accent" },
  flotte: { label: "Flotte", icon: Truck, tone: "bg-info/15 text-info" },
  planung: { label: "Planung", icon: CalendarClock, tone: "bg-primary/10 text-primary" },
  trend: { label: "Trend", icon: LineChart, tone: "bg-accent/15 text-accent" },
};

const WIRKUNG_BADGE: Record<InsightWirkung, string> = {
  hoch: "border-destructive/30 bg-destructive/10 text-destructive",
  mittel: "border-warning/30 bg-warning/10 text-warning",
  niedrig: "border-info/30 bg-info/10 text-info",
};

function InsightCard({ insight }: { insight: Insight }) {
  const meta = KAT_META[insight.kategorie];
  return (
    <Card className="group flex h-full flex-col border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.tone}`}>
            <meta.icon className="h-5 w-5" />
          </span>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
            <Badge variant="outline" className={`text-[10px] capitalize ${WIRKUNG_BADGE[insight.wirkung]}`}>
              {insight.wirkung}
            </Badge>
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold leading-snug">{insight.titel}</h3>
          <p className="text-xs leading-snug text-muted-foreground">
            <span className="font-medium text-foreground/70">Warum: </span>
            {insight.erklaerung}
          </p>
        </div>
        <p className="rounded-lg bg-muted/40 p-2.5 text-xs leading-snug">{insight.empfehlung}</p>
        <div className="mt-auto flex items-center justify-between pt-1">
          {insight.potenzial ? (
            <span className="text-xs font-semibold text-success">{insight.potenzial}</span>
          ) : (
            <span />
          )}
          <Link
            to={insight.to}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Öffnen <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightsPage() {
  const insights = computeInsights();
  const hoch = insights.filter((i) => i.wirkung === "hoch").length;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        icon={Lightbulb}
        badge={`${insights.length} Erkenntnisse`}
        title="Executive Insights"
        description="GHASI AI erkennt fortlaufend Optimierungschancen – mit klarer Begründung und Wirkungseinschätzung."
      />

      <section className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-border/70 p-5 shadow-sm">
          <p className="text-2xl font-bold tabular-nums">{insights.length}</p>
          <p className="text-xs text-muted-foreground">Erkannte Potenziale</p>
        </Card>
        <Card className="border-border/70 p-5 shadow-sm">
          <p className="text-2xl font-bold tabular-nums text-destructive">{hoch}</p>
          <p className="text-xs text-muted-foreground">Hohe Wirkung</p>
        </Card>
        <Card className="border-border/70 p-5 shadow-sm">
          <p className="text-2xl font-bold tabular-nums text-success">
            {insights.filter((i) => i.potenzial).length}
          </p>
          <p className="text-xs text-muted-foreground">Mit Sparpotenzial</p>
        </Card>
      </section>

      <ExecutiveAnalysis />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((i) => (
          <InsightCard key={i.id} insight={i} />
        ))}
        {insights.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aktuell keine Optimierungschancen erkannt – der Betrieb läuft rund.
          </p>
        )}
      </section>
    </div>
  );
}
