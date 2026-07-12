import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Euro,
  Wallet,
  Fuel,
  Wrench,
  Users,
  Car,
  ScrollText,
  ArrowRight,
  FileDown,
} from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeFinanzKpis, offenePostenJeKunde, INITIAL_RECHNUNGEN, EUR } from "@/lib/finance";
import { useInvoices } from "@/lib/invoices-store";
import { useExpenses } from "@/lib/expenses-store";
import { useCompanySettings } from "@/lib/company-settings-store";
import { SchaetzungBadge, EchtBadge } from "@/components/ui/schaetzung-badge";
import { buildDatevBuchungsstapel, datevRechnungen } from "@/lib/datev-export";
import { downloadText } from "@/lib/export-utils";
import { toISODate } from "@/lib/shifts-shared";
import { logActivity } from "@/lib/protokoll";

export const Route = createFileRoute("/buchhaltung")({
  head: () => ({
    meta: [
      { title: "Buchhaltung – GHASI AI" },
      {
        name: "description",
        content: "Einnahmen, Ausgaben, Kostenstellen und betriebswirtschaftliche Auswertung.",
      },
    ],
  }),
  component: BuchhaltungPage,
});

const KOSTEN_ICON = {
  fahrzeugkosten: Car,
  kraftstoffkosten: Fuel,
  wartungskosten: Wrench,
  fahrerkosten: Users,
  leasingkosten: ScrollText,
} as const;

const KOSTEN_LABEL = {
  fahrzeugkosten: "Fahrzeugkosten",
  kraftstoffkosten: "Kraftstoffkosten",
  wartungskosten: "Wartungskosten",
  fahrerkosten: "Fahrerkosten",
  leasingkosten: "Leasingkosten",
} as const;

function BuchhaltungPage() {
  const { data: invoiceData } = useInvoices();
  const { data: company } = useCompanySettings();
  const { data: expenseData } = useExpenses();
  const alleRechnungen = invoiceData ?? INITIAL_RECHNUNGEN;

  // Echte Kraftstoffkosten des laufenden Monats aus dem Ausgaben-Modul.
  const echteKraftstoffkostenMonat = useMemo(() => {
    const jetzt = new Date();
    const monat = jetzt.getMonth();
    const jahr = jetzt.getFullYear();
    return (expenseData ?? [])
      .filter((a) => {
        if (a.kategorie !== "Kraftstoff") return false;
        const d = new Date(a.datum);
        return d.getMonth() === monat && d.getFullYear() === jahr;
      })
      .reduce((s, a) => s + a.betragBrutto, 0);
  }, [expenseData]);

  const kostenConfig = useMemo(
    () => ({
      dieselpreis: company?.dieselpreis,
      arbeitstageMonat: company?.arbeitstageMonat,
      echteKraftstoffkostenMonat,
    }),
    [company?.dieselpreis, company?.arbeitstageMonat, echteKraftstoffkostenMonat],
  );

  const kpis = useMemo(
    () => computeFinanzKpis(alleRechnungen, kostenConfig),
    [alleRechnungen, kostenConfig],
  );
  const offen = useMemo(() => offenePostenJeKunde(alleRechnungen), [alleRechnungen]);


  const jahr = new Date().getFullYear();
  const [von, setVon] = useState(`${jahr}-01-01`);
  const [bis, setBis] = useState(toISODate(new Date()));

  const datevAnzahl = useMemo(
    () => datevRechnungen(alleRechnungen, new Date(von), new Date(bis)).length,
    [alleRechnungen, von, bis],
  );

  function exportDatev() {
    const result = buildDatevBuchungsstapel(alleRechnungen, {
      beraterNr: company.datevBeraterNr,
      mandantNr: company.datevMandantNr,
      erloeskonto: company.datevErloeskonto,
      gegenkonto: company.datevGegenkonto,
      von: new Date(von),
      bis: new Date(bis),
      bezeichnung: `Buchungsstapel ${von} bis ${bis}`,
    });
    if (result.anzahl === 0) {
      toast.error("Keine Buchungen im gewählten Zeitraum");
      return;
    }
    downloadText(`DATEV_Buchungsstapel_${von}_${bis}.csv`, result.csv, "text/csv");
    toast.success(`${result.anzahl} Buchungen exportiert (${EUR(result.summe)})`);
    logActivity({
      bereich: "Buchhaltung",
      aktion: "DATEV-Export",
      beschreibung: `DATEV-Buchungsstapel ${von}–${bis}: ${result.anzahl} Buchungen`,
    });
  }


  const kostenpositionen = (Object.keys(KOSTEN_LABEL) as (keyof typeof KOSTEN_LABEL)[]).map(
    (k) => ({
      key: k,
      label: KOSTEN_LABEL[k],
      icon: KOSTEN_ICON[k],
      wert: kpis.kosten[k],
      anteil: Math.round((kpis.kosten[k] / Math.max(1, kpis.kosten.gesamt)) * 100),
    }),
  );

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Buchhaltung"
        description="Einnahmen, Ausgaben und betriebswirtschaftliche Auswertung in Echtzeit – aus Flotte, Touren und Rechnungen."
        icon={Calculator}
        badge="Finanzen"
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Umsatz (Monat)" value={EUR(kpis.umsatzMonat)} icon={Euro} tone="primary" />
        <StatCard
          label="Ausgaben (Monat)"
          value={EUR(kpis.ausgabenMonat)}
          icon={TrendingDown}
          tone="warning"
        />
        <StatCard
          label="Gewinn (Monat)"
          value={EUR(kpis.gewinnMonat)}
          icon={TrendingUp}
          tone="success"
          hint={`Marge ${kpis.margeProzent} %`}
        />
        <StatCard
          label="Offene Posten"
          value={EUR(kpis.offenePosten)}
          icon={Wallet}
          tone="info"
          hint={`${kpis.anzahlOffen} Rechnungen`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {/* Kostenstellen */}
        <Card className="border-border/70 shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Kostenstellen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {kostenpositionen.map((p) => (
              <div key={p.key}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <p.icon className="h-4 w-4" />
                    {p.label}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {EUR(p.wert)}{" "}
                    <span className="text-xs text-muted-foreground">· {p.anteil} %</span>
                  </span>
                </div>
                <Progress value={p.anteil} className="h-2" />
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
              <span className="font-medium">Gesamtkosten</span>
              <span className="font-bold tabular-nums">{EUR(kpis.kosten.gesamt)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Cashflow / BWA Kurz */}
        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Cashflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-bold tabular-nums text-success">
                {EUR(kpis.gewinnMonat)}
              </p>
              <p className="text-sm text-muted-foreground">Netto-Cashflow diesen Monat</p>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Einnahmen" value={EUR(kpis.umsatzMonat)} tone="text-success" />
              <Row
                label="Ausgaben"
                value={`− ${EUR(kpis.ausgabenMonat)}`}
                tone="text-destructive"
              />
              <Row label="Offen (Forderungen)" value={EUR(kpis.offenePosten)} tone="text-info" />
              <Row label="Überfällig" value={EUR(kpis.ueberfaelligeSumme)} tone="text-warning" />
            </div>
            <div className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
              BWA-Kurzform aus Live-Daten. Detaillierte Auswertungen in den Berichten.
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Offene Posten je Kunde */}
      <Card className="border-border/70 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Offene Posten je Kunde</CardTitle>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/rechnungen">
              Zu den Rechnungen <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {offen.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine offenen Posten.</p>
          )}
          {offen.map((o) => (
            <div
              key={o.kundeId}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{o.kunde}</p>
                <p className="text-xs text-muted-foreground">{o.anzahl} offene Rechnung(en)</p>
              </div>
              <div className="flex items-center gap-2">
                {o.maxTageUeberfaellig > 0 && (
                  <Badge
                    variant="outline"
                    className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive"
                  >
                    {o.maxTageUeberfaellig} T überfällig
                  </Badge>
                )}
                <span className="font-semibold tabular-nums">{EUR(o.betrag)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* DATEV-Export */}
      <Card className="border-border/70 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileDown className="h-4 w-4" /> DATEV-Export für den Steuerberater
          </CardTitle>
          <Badge variant="secondary">Buchungsstapel</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Exportiert die Rechnungen als DATEV-Buchungsstapel (Format EXTF). Erlöse werden auf das
            konfigurierte Erlöskonto (SKR03 {company.datevErloeskonto}, steuerfreie Umsätze §4
            Nr.17b) gegen das Debitorenkonto {company.datevGegenkonto} gebucht.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Von</Label>
              <Input type="date" value={von} onChange={(e) => setVon(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bis</Label>
              <Input type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={exportDatev} disabled={datevAnzahl === 0}>
                <FileDown className="h-4 w-4" /> {datevAnzahl} Buchungen exportieren
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            <span className="font-semibold">Hinweis:</span> Die Kontenzuordnungen (SKR03) sind
            Standardwerte und in den Einstellungen anpassbar. Bitte lassen Sie die Zuordnung von
            Ihrem Steuerberater prüfen. Diese Angaben ersetzen keine steuerliche Beratung.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${tone}`}>{value}</span>
    </div>
  );
}
