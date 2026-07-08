import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Wallet, FileDown, Users, Building2, Landmark } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDrivers, useUpdateDriver } from "@/lib/drivers-store";
import { useCompanySettings } from "@/lib/company-settings-store";
import { EUR2 } from "@/lib/finance";
import {
  computeLohn,
  MINIJOB_GRENZE_2026,
} from "@/lib/lohn";
import { downloadLohnPdf, type LohnZeile } from "@/lib/lohn-pdf";
import {
  BESCHAEFTIGUNGSART_LABEL,
  type Beschaeftigungsart,
  type Fahrer,
} from "@/lib/fahrer";
import { STEUER_DISCLAIMER } from "@/lib/steuer";
import { logActivity } from "@/lib/protokoll";

export const Route = createFileRoute("/lohn")({
  head: () => ({
    meta: [
      { title: "Lohn-Rechner – GHASI AI" },
      {
        name: "description",
        content: "Netto-, Arbeitgeberkosten- und Minijob-Näherung je Fahrer.",
      },
    ],
  }),
  component: LohnPage,
});

const MONATE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function LohnPage() {
  const { data: drivers } = useDrivers();
  const { data: company } = useCompanySettings();
  const updateMut = useUpdateDriver();

  const now = new Date();
  const [monat, setMonat] = useState(`${MONATE[now.getMonth()]} ${now.getFullYear()}`);

  const fahrer = drivers ?? [];

  const zeilen: LohnZeile[] = useMemo(
    () =>
      fahrer.map((f) => ({
        name: f.name,
        ergebnis: computeLohn(f.beschaeftigungsart ?? "minijob", f.monatsbrutto ?? 0),
      })),
    [fahrer],
  );

  const summe = useMemo(() => {
    return zeilen.reduce(
      (acc, z) => {
        acc.netto += z.ergebnis.netto;
        acc.sv += z.ergebnis.anSozialversicherung;
        acc.steuer += z.ergebnis.anFinanzamt;
        acc.ag += z.ergebnis.agGesamt;
        return acc;
      },
      { netto: 0, sv: 0, steuer: 0, ag: 0 },
    );
  }, [zeilen]);

  async function updateFahrer(f: Fahrer, patch: Partial<Fahrer>) {
    try {
      await updateMut.mutateAsync({
        id: f.id,
        values: {
          beschaeftigungsart: patch.beschaeftigungsart ?? f.beschaeftigungsart ?? "minijob",
          monatsbrutto: patch.monatsbrutto ?? f.monatsbrutto ?? 0,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  function exportPdf() {
    if (zeilen.length === 0) {
      toast.error("Keine Fahrer vorhanden");
      return;
    }
    downloadLohnPdf(monat, zeilen, company);
    toast.success(`Lohn-Vorbereitung ${monat} als PDF exportiert`);
    logActivity({
      bereich: "Lohn",
      aktion: "PDF-Export",
      beschreibung: `Lohn-Vorbereitung ${monat}: ${EUR2(summe.netto)} Netto gesamt`,
    });
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Lohn-Rechner (informativ)"
        description="Bereitet Netto, Arbeitgeberkosten und Minijob-Prüfung je Fahrer vor. Näherungswerte 2026 – die offizielle Abrechnung erfordert zertifizierte Software oder einen Lohnservice."
        icon={Wallet}
        badge="Personal"
        right={
          <div className="flex items-center gap-2">
            <Input
              value={monat}
              onChange={(e) => setMonat(e.target.value)}
              className="w-40 border-white/30 bg-white/15 text-primary-foreground placeholder:text-primary-foreground/60"
            />
            <Button variant="secondary" onClick={exportPdf}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Auszahlung an Fahrer" value={EUR2(summe.netto)} icon={Users} tone="success" />
        <StatCard label="An Krankenkasse/Minijob-Zentrale" value={EUR2(summe.sv)} icon={Building2} tone="warning" />
        <StatCard label="An Finanzamt (Lohnsteuer)" value={EUR2(summe.steuer)} icon={Landmark} tone="info" />
        <StatCard label="AG-Gesamtkosten" value={EUR2(summe.ag)} icon={Wallet} tone="primary" />
      </section>

      <Card className="border-border/70 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Fahrer &amp; Beschäftigung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {fahrer.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Fahrer vorhanden.</p>
          )}
          {fahrer.map((f) => {
            const e = computeLohn(f.beschaeftigungsart ?? "minijob", f.monatsbrutto ?? 0);
            return (
              <div
                key={f.id}
                className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 lg:grid-cols-[1.2fr_1.4fr_0.8fr_2fr] lg:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.nummer}</p>
                </div>

                <Select
                  value={f.beschaeftigungsart ?? "minijob"}
                  onValueChange={(v) =>
                    updateFahrer(f, { beschaeftigungsart: v as Beschaeftigungsart })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(BESCHAEFTIGUNGSART_LABEL) as Beschaeftigungsart[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {BESCHAEFTIGUNGSART_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="Brutto €"
                    defaultValue={f.monatsbrutto || ""}
                    onBlur={(ev) => {
                      const val = Number(ev.target.value);
                      if (Number.isFinite(val) && val !== (f.monatsbrutto ?? 0)) {
                        updateFahrer(f, { monatsbrutto: val });
                      }
                    }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span>
                    Netto: <span className="font-semibold tabular-nums">{EUR2(e.netto)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    SV: <span className="tabular-nums">{EUR2(e.anSozialversicherung)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    AG-Kosten: <span className="tabular-nums">{EUR2(e.agGesamt)}</span>
                  </span>
                  {e.warnung && (
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive"
                    >
                      {e.warnung}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
        <span className="font-semibold">Wichtig:</span> Die offizielle Lohnabrechnung und die Meldungen
        an Sozialversicherung/Finanzamt erfordern zertifizierte Software oder einen Lohnservice. Dieser
        Rechner bereitet alle Werte für die Übergabe vor (Näherung, Minijob-Grenze {MINIJOB_GRENZE_2026}{" "}
        €/Monat). {STEUER_DISCLAIMER}
      </div>
    </div>
  );
}
