import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Inbox, Search, MailCheck, Sparkles, ArrowRight, CheckCheck } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConversationPanel } from "@/components/kommunikation/conversation-panel";
import { cn } from "@/lib/utils";
import {
  KATEGORIE_META,
  KATEGORIE_REIHENFOLGE,
  KANAL_META,
  PRIORITAET_META,
  letzteNachricht,
  formatZeit,
  type KommKategorie,
  type KommPrioritaet,
} from "@/lib/communication";
import {
  useKonversationen,
  useOffeneEntwuerfeAnzahl,
  markiereGelesen,
  alleGelesen,
} from "@/lib/communication-store";

export const Route = createFileRoute("/posteingang")({
  head: () => ({
    meta: [
      { title: "Posteingang – GHASI AI" },
      {
        name: "description",
        content:
          "Vereinheitlichter Posteingang von GHASI AI: alle Nachrichten zu Dispatch, Fahrern, Patienten, Kunden, Finanzen, Wartung, KI & kritischen Alarmen – verknüpft mit dem Ursprungsobjekt.",
      },
    ],
  }),
  component: Posteingang,
});

const PRIOS: (KommPrioritaet | "alle")[] = ["alle", "kritisch", "hoch", "normal", "niedrig"];

function Posteingang() {
  const konversationen = useKonversationen();
  const offeneEntwuerfe = useOffeneEntwuerfeAnzahl();
  const [kategorie, setKategorie] = useState<KommKategorie | "alle">("alle");
  const [prio, setPrio] = useState<KommPrioritaet | "alle">("alle");
  const [suche, setSuche] = useState("");
  const [aktivId, setAktivId] = useState<string | null>(null);

  const ungelesen = konversationen.filter((k) => !k.gelesen).length;

  const countsProKategorie = useMemo(() => {
    const c: Record<string, number> = {};
    for (const k of konversationen) if (!k.gelesen) c[k.kategorie] = (c[k.kategorie] ?? 0) + 1;
    return c;
  }, [konversationen]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return konversationen
      .filter((k) => kategorie === "alle" || k.kategorie === kategorie)
      .filter((k) => prio === "alle" || k.prioritaet === prio)
      .filter((k) => {
        if (!q) return true;
        const text = `${k.betreff} ${k.partner} ${k.bezug?.label ?? ""} ${k.nachrichten
          .map((n) => n.text)
          .join(" ")}`.toLowerCase();
        return text.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(letzteNachricht(b)?.zeit ?? 0).getTime() -
          new Date(letzteNachricht(a)?.zeit ?? 0).getTime(),
      );
  }, [konversationen, kategorie, prio, suche]);

  const aktiv = konversationen.find((k) => k.id === aktivId) ?? null;

  const oeffnen = (id: string) => {
    setAktivId(id);
    markiereGelesen(id, true);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        icon={Inbox}
        badge={`${ungelesen} ungelesen`}
        title="Posteingang"
        description="Eine zentrale Kommunikations­schicht für alle Module – jede Nachricht ist mit ihrem Ursprungsobjekt verknüpft."
        right={
          <Link to="/aktions-center">
            <Button variant="secondary" size="sm" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              Aktions-Center
              {offeneEntwuerfe > 0 && (
                <Badge className="ml-1 border-0 bg-primary text-primary-foreground">{offeneEntwuerfe}</Badge>
              )}
            </Button>
          </Link>
        }
      />

      {/* Category filter chips */}
      <section className="flex flex-wrap gap-2">
        <CategoryChip
          label="Alle"
          active={kategorie === "alle"}
          count={ungelesen}
          onClick={() => setKategorie("alle")}
        />
        {KATEGORIE_REIHENFOLGE.map((kat) => {
          const meta = KATEGORIE_META[kat];
          const Icon = meta.icon;
          return (
            <button
              key={kat}
              onClick={() => setKategorie(kategorie === kat ? "alle" : kat)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                kategorie === kat
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/70 bg-card hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {meta.label}
              {countsProKategorie[kat] ? (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {countsProKategorie[kat]}
                </span>
              ) : null}
            </button>
          );
        })}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* List column */}
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Nachrichten durchsuchen …"
                className="pl-9"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={alleGelesen}
              disabled={ungelesen === 0}
            >
              <CheckCheck className="h-4 w-4" />
              Alle gelesen
            </Button>
          </div>

          {/* Priority filter */}
          <div className="flex flex-wrap gap-1.5">
            {PRIOS.map((p) => (
              <button
                key={p}
                onClick={() => setPrio(p)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  prio === p ? "border-primary bg-primary/5" : "border-border/70 bg-card hover:bg-muted",
                )}
              >
                {p === "alle" ? "Alle Prioritäten" : PRIORITAET_META[p].label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {gefiltert.map((k) => {
              const meta = KATEGORIE_META[k.kategorie];
              const kanal = KANAL_META[k.kanal];
              const prioMeta = PRIORITAET_META[k.prioritaet];
              const last = letzteNachricht(k);
              const Icon = meta.icon;
              return (
                <button
                  key={k.id}
                  onClick={() => oeffnen(k.id)}
                  className={cn(
                    "w-full rounded-2xl border p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-card",
                    aktivId === k.id ? "border-primary bg-primary/5 shadow-card" : "border-border/70 bg-card shadow-sm",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className={cn("relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.ring)}>
                      <Icon className="h-4 w-4" />
                      {!k.gelesen && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-sm", k.gelesen ? "font-medium" : "font-semibold")}>
                          {k.betreff}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {last ? formatZeit(last.zeit) : ""}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{k.partner}</p>
                      {last && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{last.text}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-[10px]", kanal.badge)}>
                          {kanal.label}
                        </Badge>
                        <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px]", prioMeta.badge)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", prioMeta.dot)} />
                          {prioMeta.label}
                        </span>
                        {k.bezug && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-primary">
                            {k.bezug.label}
                            <ArrowRight className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {gefiltert.length === 0 && (
              <Card className="border-dashed border-border/70 bg-muted/30">
                <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                  <MailCheck className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Keine Nachrichten für diesen Filter.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Conversation column */}
        <Card className="hidden min-h-[28rem] overflow-hidden border-border/70 shadow-card lg:flex lg:flex-col">
          {aktiv ? (
            <ConversationPanel konversation={aktiv} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <div className="bg-gradient-accent flex h-12 w-12 items-center justify-center rounded-2xl shadow-glow">
                <Inbox className="h-6 w-6 text-primary-foreground" />
              </div>
              <p className="text-base font-semibold">Unterhaltung auswählen</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Wählen Sie eine Nachricht aus, um den vollständigen Verlauf zu sehen und zu antworten.
              </p>
            </div>
          )}
        </Card>

        {/* Mobile conversation */}
        {aktiv && (
          <Card className="overflow-hidden border-border/70 shadow-card lg:hidden">
            <div className="flex h-[28rem] flex-col">
              <ConversationPanel konversation={aktiv} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        active ? "border-primary bg-primary/5 shadow-sm" : "border-border/70 bg-card hover:bg-muted",
      )}
    >
      {label}
      {count ? (
        <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}
