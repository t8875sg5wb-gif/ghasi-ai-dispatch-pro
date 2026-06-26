import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, RefreshCw, TrendingUp, AlertTriangle, ListChecks, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/ki/markdown";
import { generateExecutiveAnalysis } from "@/lib/ai-brain.functions";

function Lane({
  title,
  icon: Icon,
  tone,
  items,
}: {
  title: string;
  icon: typeof TrendingUp;
  tone: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <ul className="space-y-1.5">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm leading-snug text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/30" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Executive AI briefing card – real Lovable AI analysis of the live AI Brain context. */
export function ExecutiveAnalysis() {
  const analyse = useServerFn(generateExecutiveAnalysis);
  const { data, isFetching, refetch, isError } = useQuery({
    queryKey: ["executive-analysis"],
    queryFn: () => analyse(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Bot className="h-4 w-4" />
          </div>
          <CardTitle className="text-base">GHASI AI · Executive-Analyse</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Aktualisieren</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isFetching && !data && (
          <div className="space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <p className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 animate-pulse text-accent" />
              GHASI AI analysiert die aktuelle Unternehmenslage …
            </p>
          </div>
        )}

        {(isError || data?.fehler) && !isFetching && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {data?.fehler ?? "Die KI-Analyse konnte nicht geladen werden."}
          </div>
        )}

        {data && !data.fehler && (
          <>
            {data.lageeinschaetzung && (
              <div className="rounded-xl bg-muted/40 p-4 text-sm leading-relaxed">
                <Markdown content={data.lageeinschaetzung} />
              </div>
            )}
            <div className="grid gap-3 lg:grid-cols-3">
              <Lane title="Chancen" icon={TrendingUp} tone="bg-success/15 text-success" items={data.chancen} />
              <Lane title="Risiken" icon={AlertTriangle} tone="bg-warning/20 text-warning" items={data.risiken} />
              <Lane title="Nächste Schritte" icon={ListChecks} tone="bg-primary/10 text-primary" items={data.naechsteSchritte} />
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Nur Empfehlungen · keine automatische Ausführung
            </Badge>
          </>
        )}
      </CardContent>
    </Card>
  );
}
