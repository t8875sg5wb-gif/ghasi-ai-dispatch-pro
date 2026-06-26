import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Euro,
  TrendingUp,
  ClipboardList,
  Loader,
  UserCheck,
  UserPlus,
  Truck,
  Car,
  Fuel,
  Gauge,
  Activity,
  AlertTriangle,
  CloudSun,
  TrafficCone,
  CalendarDays,
  Sparkles,
  ArrowRight,
  Inbox,
  ListTodo,
  BadgeCheck,
  Zap,
  Bot,
  ClipboardCheck,
} from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { ExecutiveHealth } from "@/components/dashboard/executive-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { generateHinweise, type Hinweis, type HinweisStufe } from "@/lib/ghasi-hinweise";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard – GHASI AI" },
      {
        name: "description",
        content:
          "Echtzeit-Dashboard für Ihr Krankentransportunternehmen: Umsatz, Aufträge, Flotte, Auslastung und KI-Empfehlungen auf einen Blick.",
      },
    ],
  }),
  component: Dashboard,
});

const stats = [
  {
    label: "Umsatz heute",
    value: "8.420 €",
    icon: Euro,
    tone: "primary" as const,
    trend: { value: "12 %", positive: true },
    hint: "vs. gestern",
  },
  {
    label: "Gewinn heute",
    value: "2.180 €",
    icon: TrendingUp,
    tone: "success" as const,
    trend: { value: "8 %", positive: true },
    hint: "Marge 26 %",
  },
  {
    label: "Offene Aufträge",
    value: "14",
    icon: ClipboardList,
    tone: "info" as const,
    hint: "5 dringend",
  },
  {
    label: "Laufende Aufträge",
    value: "9",
    icon: Loader,
    tone: "accent" as const,
    hint: "in Bearbeitung",
  },
  {
    label: "Fahrer unterwegs",
    value: "11",
    icon: UserCheck,
    tone: "primary" as const,
    hint: "von 18 aktiv",
  },
  {
    label: "Freie Fahrer",
    value: "7",
    icon: UserPlus,
    tone: "success" as const,
    hint: "verfügbar",
  },
  {
    label: "Fahrzeuge unterwegs",
    value: "10",
    icon: Truck,
    tone: "info" as const,
    hint: "von 16 Fahrzeugen",
  },
  {
    label: "Freie Fahrzeuge",
    value: "6",
    icon: Car,
    tone: "accent" as const,
    hint: "einsatzbereit",
  },
  {
    label: "Tankkosten",
    value: "612 €",
    icon: Fuel,
    tone: "warning" as const,
    trend: { value: "3 %", positive: false },
    hint: "heute",
  },
  {
    label: "Leerkilometer",
    value: "184 km",
    icon: Gauge,
    tone: "warning" as const,
    trend: { value: "5 %", positive: false },
    hint: "Optimierung möglich",
  },
];

const warnings = [
  { text: "Fahrzeug B-KT 142 – TÜV in 6 Tagen fällig", level: "Hoch" },
  { text: "Fahrer M. Keller – Führerschein-Prüfung überfällig", level: "Hoch" },
  { text: "3 Rechnungen über Zahlungsziel", level: "Mittel" },
];

const recommendations = [
  "Tour #A-204 kann mit #A-209 zusammengelegt werden – spart ca. 22 km Leerfahrt.",
  "2 freie Fahrer für die Dialyse-Frühschicht morgen 06:00 einplanen.",
  "Kraftstoffpreise heute günstig – Tankvorgänge vorziehen empfohlen.",
];

const appointments = [
  { time: "08:30", text: "Dialyse-Sammeltour Zentrum Nord", tag: "Tour" },
  { time: "11:00", text: "Wartungstermin B-KT 097", tag: "Werkstatt" },
  { time: "14:15", text: "Kunde Klinikum West – Vertragsgespräch", tag: "Termin" },
  { time: "16:45", text: "Rückfahrt Pflegeheim Sonnenhof", tag: "Auftrag" },
];

const aufgaben = [
  { text: "3 Rechnungen über Zahlungsziel prüfen", to: "/rechnungen" },
  { text: "Dialyse-Frühschicht morgen disponieren", to: "/tourenplanung" },
  { text: "TÜV-Termin für B-KT 142 vereinbaren", to: "/wartung" },
];

const nachrichten = [
  { von: "Klinikum West", text: "Rückfahrt 16:45 bestätigt", to: "/telefon" },
  { von: "Fahrer M. Keller", text: "Verspätung 10 Min – Stau A100", to: "/fahrer" },
];

const genehmigungen = [
  { text: "Überstundenfreigabe S. Aydin (12 h)", to: "/fahrer" },
  { text: "Reparaturfreigabe B-KT 097 (480 €)", to: "/wartung" },
];

const kiAufgaben = [
  { text: "Tour A-204 + A-209 zusammenlegen", to: "/tourenplanung" },
  { text: "Tankstopp B-KT 211 vorschlagen", to: "/fahrzeuge" },
];

const schnellzugriffe = [
  { label: "Neuer Auftrag", to: "/auftraege", icon: ClipboardList },
  { label: "Fahrer", to: "/fahrer", icon: UserCheck },
  { label: "Fahrzeuge", to: "/fahrzeuge", icon: Truck },
  { label: "Tourenplanung", to: "/tourenplanung", icon: Activity },
  { label: "Rechnungen", to: "/rechnungen", icon: Euro },
  { label: "GHASI AI", to: "/ki-assistent", icon: Bot },
];

const stufeStyle: Record<HinweisStufe, string> = {
  kritisch: "bg-destructive",
  warnung: "bg-warning",
  info: "bg-info",
  positiv: "bg-success",
};

function Dashboard() {
  // Zeit-/datumsabhängige Hinweise erst nach Mount erzeugen (kein SSR-Mismatch).
  const [hinweise, setHinweise] = useState<Hinweis[]>([]);
  useEffect(() => setHinweise(generateHinweise()), []);
  const auslastungFahrzeuge = 63;
  const auslastungFahrer = 61;
  const prognose = "11.900 €";

  return (
    <div className="animate-fade-in space-y-6">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Guten Tag 👋</h1>
            <p className="text-sm text-muted-foreground">
              Hier ist die Echtzeit-Übersicht Ihres Unternehmens.
            </p>
          </div>
          <Button asChild className="rounded-full">
            <Link to="/ki-assistent">
              <Sparkles className="h-4 w-4" />
              GHASI AI fragen
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </section>

      {/* Executive Business Health */}
      <ExecutiveHealth />

      {/* Schnellzugriffe */}
      <section className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {schnellzugriffe.map((q) => (
          <Link
            key={q.label}
            to={q.to}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <q.icon className="h-5 w-5" />
            </span>
            <span className="text-xs font-medium leading-tight">{q.label}</span>
          </Link>
        ))}
      </section>

      {/* Proaktive Hinweise + Gewinnprognose */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Bot className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">Proaktive Hinweise von GHASI AI</CardTitle>
            </div>
            <Badge variant="secondary">{hinweise.length}</Badge>
          </CardHeader>
          <CardContent className="grid gap-2.5 sm:grid-cols-2">
            {hinweise.slice(0, 6).map((h) => (
              <Link
                key={h.id}
                to={h.to}
                className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-muted/60"
              >
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${stufeStyle[h.stufe]}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug">{h.titel}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{h.text}</p>
                </div>
              </Link>
            ))}
            {hinweise.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aktuell keine Hinweise – alles im grünen Bereich.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/15 text-success">
              <TrendingUp className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Gewinnprognose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold tabular-nums">{prognose}</p>
              <p className="text-sm text-muted-foreground">erwarteter Gewinn diese Woche</p>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Wochenziel</span>
                <span className="font-semibold">79 %</span>
              </div>
              <Progress value={79} className="h-2" />
            </div>
            <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
              Bei aktueller Auslastung ({auslastungFahrzeuge}% Fahrzeuge / {auslastungFahrer}%
              Fahrer) wird das Wochenziel voraussichtlich erreicht.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Offene Aufgaben / Nachrichten / Genehmigungen / KI-Aufgaben */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardListCard
          title="Offene Aufgaben"
          icon={ListTodo}
          tone="text-primary bg-primary/10"
          count={aufgaben.length}
          items={aufgaben.map((a) => ({ to: a.to, primary: a.text }))}
        />
        <DashboardListCard
          title="Neue Nachrichten"
          icon={Inbox}
          tone="text-info bg-info/15"
          count={nachrichten.length}
          items={nachrichten.map((n) => ({ to: n.to, primary: n.text, secondary: n.von }))}
        />
        <DashboardListCard
          title="Offene Genehmigungen"
          icon={BadgeCheck}
          tone="text-warning bg-warning/20"
          count={genehmigungen.length}
          items={genehmigungen.map((g) => ({ to: g.to, primary: g.text }))}
          badge="Bestätigung nötig"
        />
        <DashboardListCard
          title="KI-Aufgaben"
          icon={Zap}
          tone="text-accent bg-accent/15"
          count={kiAufgaben.length}
          items={kiAufgaben.map((k) => ({ to: k.to, primary: k.text }))}
          badge="Vorschlag"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Auslastung */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Activity className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Auslastung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fahrzeuge</span>
                <span className="font-semibold">63 %</span>
              </div>
              <Progress value={63} className="h-2" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fahrer</span>
                <span className="font-semibold">61 %</span>
              </div>
              <Progress value={61} className="h-2" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tagesplan</span>
                <span className="font-semibold">78 %</span>
              </div>
              <Progress value={78} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Warnungen */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/20 text-warning">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">Warnungen</CardTitle>
            </div>
            <Badge variant="secondary">{warnings.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {warnings.map((w) => (
              <div
                key={w.text}
                className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3"
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    w.level === "Hoch" ? "bg-destructive" : "bg-warning"
                  }`}
                />
                <p className="text-sm leading-snug">{w.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* KI-Empfehlungen */}
        <Card className="bg-gradient-primary border-0 text-primary-foreground shadow-glow">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <Sparkles className="h-4 w-4" />
            </div>
            <CardTitle className="text-base text-primary-foreground">KI-Empfehlungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {recommendations.map((r) => (
              <div
                key={r}
                className="rounded-xl bg-white/10 p-3 text-sm leading-snug backdrop-blur"
              >
                {r}
              </div>
            ))}
            <Button asChild variant="secondary" size="sm" className="mt-1 w-full rounded-full">
              <Link to="/ki-assistent">
                Mehr mit GHASI AI <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Wetter */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/15 text-info">
              <CloudSun className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Wetter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold tabular-nums">14°</p>
                <p className="text-sm text-muted-foreground">Leicht bewölkt · Berlin</p>
              </div>
              <CloudSun className="h-12 w-12 text-info/70" />
            </div>
            <p className="mt-3 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
              Gute Fahrbedingungen – keine Einschränkungen erwartet.
            </p>
          </CardContent>
        </Card>

        {/* Verkehr */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/20 text-warning">
              <TrafficCone className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Verkehr</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">A100 Richtung Mitte</span>
              <Badge variant="secondary" className="bg-warning/20 text-warning">
                Stau 8 km
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">B96 Innenstadt</span>
              <Badge variant="secondary" className="bg-success/15 text-success">
                Frei
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Klinikum West</span>
              <Badge variant="secondary" className="bg-success/15 text-success">
                Flüssig
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Kalender */}
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <CalendarDays className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Kalender heute</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {appointments.map((a) => (
              <div key={a.time} className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5">
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-primary">
                  {a.time}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm">{a.text}</p>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {a.tag}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

interface ListItem {
  to: string;
  primary: string;
  secondary?: string;
}

function DashboardListCard({
  title,
  icon: Icon,
  tone,
  count,
  items,
  badge,
}: {
  title: string;
  icon: typeof Inbox;
  tone: string;
  count: number;
  items: ListItem[];
  badge?: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <Badge variant="secondary">{count}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {badge && (
          <Badge variant="outline" className="mb-1 text-[10px]">
            <ClipboardCheck className="mr-1 h-3 w-3" />
            {badge}
          </Badge>
        )}
        {items.map((item) => (
          <Link
            key={item.primary}
            to={item.to}
            className="block rounded-xl bg-muted/30 p-2.5 transition-colors hover:bg-muted/60"
          >
            {item.secondary && (
              <p className="text-[11px] font-medium text-muted-foreground">{item.secondary}</p>
            )}
            <p className="text-sm leading-snug">{item.primary}</p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
