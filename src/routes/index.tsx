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
  CalendarDays,
  Sparkles,
  ArrowRight,
  Inbox,
  ListTodo,
  Zap,
  Bot,
} from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import { ExecutiveHealth } from "@/components/dashboard/executive-health";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { generateHinweise, type Hinweis, type HinweisStufe } from "@/lib/ghasi-hinweise";
import { useOrders } from "@/lib/orders-store";
import { useDrivers } from "@/lib/drivers-store";
import { useInvoices } from "@/lib/invoices-store";
import { useCalls } from "@/lib/calls-store";
import { computeKpis, EUR } from "@/lib/ai-brain";
import { computeFinanzKpis } from "@/lib/finance";
import {
  computeCashflowForecast,
  computeEmptyMileage,
  computeCeoRecommendations,
} from "@/lib/ceo-intelligence";
import { UnassignedAlerts } from "@/components/auftraege/unassigned-alerts";
import { LiveFleetMapCard } from "@/components/gps/live-fleet-map-card";
import { istUnzugewiesen, auftragProbleme } from "@/lib/order-urgency";
import { AlertTriangle as AlertTriangleIcon, FileWarning } from "lucide-react";

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

const stufeStyle: Record<HinweisStufe, string> = {
  kritisch: "bg-destructive",
  warnung: "bg-warning",
  info: "bg-info",
  positiv: "bg-success",
};

const schnellzugriffe = [
  { label: "Neuer Auftrag", to: "/auftraege", icon: ClipboardList },
  { label: "Fahrer", to: "/fahrer", icon: UserCheck },
  { label: "Fahrzeuge", to: "/fahrzeuge", icon: Truck },
  { label: "Tourenplanung", to: "/tourenplanung", icon: Activity },
  { label: "Rechnungen", to: "/rechnungen", icon: Euro },
  { label: "GHASI AI", to: "/ki-assistent", icon: Bot },
] as const;

function istHeute(iso: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function Dashboard() {
  // Live-Hydration der geteilten Spiegel (Aufträge/Fahrer/Rechnungen/Anrufe),
  // damit alle deterministischen Kennzahlen auf den echten Daten laufen.
  const { data: auftraege = [] } = useOrders();
  useDrivers();
  const { data: rechnungen = [] } = useInvoices();
  const { data: anrufe = [] } = useCalls();

  // Zeit-/datumsabhängige Hinweise erst nach Mount erzeugen (kein SSR-Mismatch).
  const [hinweise, setHinweise] = useState<Hinweis[]>([]);
  useEffect(() => setHinweise(generateHinweise()), [auftraege, rechnungen]);

  const kpis = computeKpis();
  const fin = computeFinanzKpis();
  const empty = computeEmptyMileage();
  const cashflow = computeCashflowForecast(kpis);
  const recs = computeCeoRecommendations();
  const prognose7 = cashflow[0];

  const gesamtFahrer = kpis.aktiveFahrer + kpis.freieFahrer;
  const gesamtFahrzeuge = kpis.aktiveFahrzeuge + kpis.freieFahrzeuge;

  const stats = [
    {
      label: "Umsatz heute",
      value: EUR(kpis.umsatzHeute),
      icon: Euro,
      tone: "primary" as const,
      hint: `Monat ${EUR(kpis.umsatzMonat)}`,
    },
    {
      label: "Gewinn heute",
      value: EUR(kpis.gewinnHeute),
      icon: TrendingUp,
      tone: "success" as const,
      hint: `Marge ${kpis.margeProzent} %`,
    },
    {
      label: "Offene Aufträge",
      value: String(kpis.offeneTransporte),
      icon: ClipboardList,
      tone: "info" as const,
      hint: "neu & disponiert",
    },
    {
      label: "Laufende Aufträge",
      value: String(kpis.laufendeTransporte),
      icon: Loader,
      tone: "accent" as const,
      hint: "in Bearbeitung",
    },
    {
      label: "Fahrer unterwegs",
      value: String(kpis.aktiveFahrer),
      icon: UserCheck,
      tone: "primary" as const,
      hint: `von ${gesamtFahrer} aktiv`,
    },
    {
      label: "Freie Fahrer",
      value: String(kpis.freieFahrer),
      icon: UserPlus,
      tone: "success" as const,
      hint: "verfügbar",
    },
    {
      label: "Fahrzeuge unterwegs",
      value: String(kpis.aktiveFahrzeuge),
      icon: Truck,
      tone: "info" as const,
      hint: `von ${gesamtFahrzeuge} Fahrzeugen`,
    },
    {
      label: "Freie Fahrzeuge",
      value: String(kpis.freieFahrzeuge),
      icon: Car,
      tone: "accent" as const,
      hint: "einsatzbereit",
    },
    {
      label: "Kraftstoff / Monat",
      value: EUR(fin.kosten.kraftstoffkosten),
      icon: Fuel,
      tone: "warning" as const,
      hint: "geschätzt",
    },
    {
      label: "Leerkilometer",
      value: `${empty.leerKm} km`,
      icon: Gauge,
      tone: "warning" as const,
      hint: `${empty.anteilProzent} % · Optimierung möglich`,
    },
  ];

  // Warnungen aus echten Hinweisen (kritisch/warnung).
  const warnungen = hinweise.filter((h) => h.stufe === "kritisch" || h.stufe === "warnung");

  // Offene Aufgaben – dynamisch aus echten Signalen.
  const aufgaben: { text: string; to: string }[] = [];
  if (fin.anzahlUeberfaellig > 0)
    aufgaben.push({
      text: `${fin.anzahlUeberfaellig} überfällige Rechnung(en) prüfen (${EUR(fin.ueberfaelligeSumme)})`,
      to: "/rechnungen",
    });
  const unbesetzt = auftraege.filter(
    (a) => (a.status === "neu" || a.status === "disponiert") && !a.fahrer,
  ).length;
  if (unbesetzt > 0)
    aufgaben.push({ text: `${unbesetzt} Auftrag/Aufträge ohne Fahrer disponieren`, to: "/tourenplanung" });
  if (kpis.kritischeAlarme > 0)
    aufgaben.push({
      text: `${kpis.kritischeAlarme} Fahrzeug(e) mit ablaufender Frist (TÜV/Versicherung/Wartung)`,
      to: "/warnungen",
    });

  // Neue Nachrichten – aus offenen/rückruf-pflichtigen Anrufen.
  const offeneAnrufe = anrufe
    .filter((a) => a.status === "offen" || a.status === "rueckruf")
    .slice(0, 4);

  // KI-Aufgaben – aus echten CEO-Empfehlungen.
  const kiAufgaben = recs.slice(0, 3);

  // Kalender heute – echte Termine aus den Aufträgen.
  const termineHeute = [...auftraege]
    .filter((a) => a.status !== "storniert" && istHeute(a.termin))
    .sort((a, b) => new Date(a.termin).getTime() - new Date(b.termin).getTime())
    .slice(0, 6);

  // Geschäftsführer-Überblick: die sechs Kernzahlen des Tages.
  const fahrtenHeute = auftraege.filter(
    (a) => a.status !== "storniert" && istHeute(a.termin),
  ).length;
  const nichtZugewiesen = auftraege.filter(istUnzugewiesen).length;
  const dringendeWarnungen = auftraege.filter((a) =>
    auftragProbleme(a, auftraege).some((p) => p.stufe === "kritisch"),
  ).length;

  const chefStats = [
    {
      label: "Fahrten heute",
      value: String(fahrtenHeute),
      icon: CalendarDays,
      tone: "primary" as const,
      hint: "geplant für heute",
    },
    {
      label: "Offene Fahrten",
      value: String(kpis.offeneTransporte),
      icon: ClipboardList,
      tone: "info" as const,
      hint: "neu & disponiert",
    },
    {
      label: "Nicht zugewiesen",
      value: String(nichtZugewiesen),
      icon: UserPlus,
      tone: nichtZugewiesen > 0 ? ("warning" as const) : ("success" as const),
      hint: "ohne Fahrer/Fahrzeug",
    },
    {
      label: "Dringende Warnungen",
      value: String(dringendeWarnungen),
      icon: AlertTriangleIcon,
      tone: dringendeWarnungen > 0 ? ("warning" as const) : ("success" as const),
      hint: "sofort prüfen",
    },
    {
      label: "Einnahmen (Monat)",
      value: EUR(kpis.umsatzMonat),
      icon: Euro,
      tone: "success" as const,
      hint: "grob geschätzt",
    },
    {
      label: "Offene Rechnungen",
      value: String(fin.anzahlOffen),
      icon: FileWarning,
      tone: fin.anzahlUeberfaellig > 0 ? ("warning" as const) : ("accent" as const),
      hint: EUR(fin.offenePosten),
    },
  ];

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

      {/* Dringende, nicht zugewiesene Aufträge */}
      <UnassignedAlerts auftraege={auftraege} />

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
            <CardTitle className="text-base">Gewinnprognose (7 Tage)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold tabular-nums">{EUR(prognose7.gewinn)}</p>
              <p className="text-sm text-muted-foreground">
                erwarteter Gewinn · Umsatz {EUR(prognose7.umsatz)}
              </p>
            </div>
            <div className="space-y-2 text-sm">
              {cashflow.slice(1).map((c) => (
                <div key={c.tage} className="flex items-center justify-between">
                  <span className="text-muted-foreground">Gewinn {c.label}</span>
                  <span className="font-semibold tabular-nums">{EUR(c.gewinn)}</span>
                </div>
              ))}
            </div>
            <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
              Prognose auf Basis der aktuellen Auslastung ({kpis.flottenauslastung} % Fahrzeuge /{" "}
              {kpis.fahrerauslastung} % Fahrer).
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Offene Aufgaben / Nachrichten / KI-Aufgaben */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardListCard
          title="Offene Aufgaben"
          icon={ListTodo}
          tone="text-primary bg-primary/10"
          count={aufgaben.length}
          items={aufgaben.map((a) => ({ to: a.to, primary: a.text }))}
          leer="Keine offenen Aufgaben."
        />
        <DashboardListCard
          title="Neue Nachrichten"
          icon={Inbox}
          tone="text-info bg-info/15"
          count={offeneAnrufe.length}
          items={offeneAnrufe.map((n) => ({
            to: "/telefon",
            primary: n.notiz || n.kategorie,
            secondary: n.name || n.nummer,
          }))}
          leer="Keine offenen Anrufe."
        />
        <DashboardListCard
          title="KI-Aufgaben"
          icon={Zap}
          tone="text-accent bg-accent/15"
          count={kiAufgaben.length}
          items={kiAufgaben.map((k) => ({ to: k.to, primary: k.titel, secondary: k.impact }))}
          badge="Vorschlag"
          leer="Aktuell keine KI-Vorschläge."
        />
      </section>

      {/* Interaktive Live-Flottenkarte (Google Maps) */}
      <section>
        <LiveFleetMapCard height="h-[360px]" />
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
                <span className="font-semibold">{kpis.flottenauslastung} %</span>
              </div>
              <Progress value={kpis.flottenauslastung} className="h-2" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Fahrer</span>
                <span className="font-semibold">{kpis.fahrerauslastung} %</span>
              </div>
              <Progress value={kpis.fahrerauslastung} className="h-2" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">KI-Effizienz</span>
                <span className="font-semibold">{kpis.aiEffizienz} %</span>
              </div>
              <Progress value={kpis.aiEffizienz} className="h-2" />
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
            <Badge variant="secondary">{warnungen.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {warnungen.slice(0, 6).map((w) => (
              <Link
                key={w.id}
                to={w.to}
                className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-muted/60"
              >
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    w.stufe === "kritisch" ? "bg-destructive" : "bg-warning"
                  }`}
                />
                <p className="text-sm leading-snug">{w.titel}</p>
              </Link>
            ))}
            {warnungen.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine aktiven Warnungen.</p>
            )}
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
            {recs.slice(0, 3).map((r) => (
              <div
                key={r.id}
                className="rounded-xl bg-white/10 p-3 text-sm leading-snug backdrop-blur"
              >
                <p className="font-medium">{r.titel}</p>
                <p className="mt-0.5 text-xs text-primary-foreground/80">{r.impact}</p>
              </div>
            ))}
            {recs.length === 0 && (
              <p className="rounded-xl bg-white/10 p-3 text-sm backdrop-blur">
                Keine dringenden Empfehlungen – der Betrieb läuft rund.
              </p>
            )}
            <Button asChild variant="secondary" size="sm" className="mt-1 w-full rounded-full">
              <Link to="/ki-assistent">
                Mehr mit GHASI AI <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Kalender heute (echte Termine aus Aufträgen) */}
      <section>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <CalendarDays className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Termine heute</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {termineHeute.map((a) => (
              <Link
                key={a.id}
                to="/auftraege"
                className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5 transition-colors hover:bg-muted/60"
              >
                <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-primary">
                  {new Date(a.termin).toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <p className="min-w-0 flex-1 truncate text-sm">
                  {a.patient} · {a.zielort || a.destination?.city || a.transportart}
                </p>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {a.transportart}
                </Badge>
              </Link>
            ))}
            {termineHeute.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine Termine für heute geplant.</p>
            )}
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
  leer,
}: {
  title: string;
  icon: typeof Inbox;
  tone: string;
  count: number;
  items: ListItem[];
  badge?: string;
  leer: string;
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
        {badge && items.length > 0 && (
          <Badge variant="outline" className="mb-1 text-[10px]">
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
        {items.length === 0 && <p className="text-sm text-muted-foreground">{leer}</p>}
      </CardContent>
    </Card>
  );
}
