import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ScrollText, TrendingUp, TrendingDown, Euro, FileDown } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInvoices } from "@/lib/invoices-store";
import { useExpenses } from "@/lib/expenses-store";
import { useCompanySettings } from "@/lib/company-settings-store";
import { EUR2 } from "@/lib/finance";
import { computeEuer, verfuegbareJahre, MONATSNAMEN } from "@/lib/euer";
import { downloadEuerPdf } from "@/lib/euer-pdf";
import { STEUER_DISCLAIMER } from "@/lib/steuer";
import { logActivity } from "@/lib/protokoll";

export const Route = createFileRoute("/euer")({
  head: () => ({
    meta: [
      { title: "EÜR – GHASI AI" },
      { name: "description", content: "Einnahmen-Überschuss-Rechnung als Vorbereitung für ELSTER." },
    ],
  }),
  component: EuerPage,
});

function EuerPage() {
  const { data: invoices } = useInvoices();
  const { data: expenses } = useExpenses();
  const { data: company } = useCompanySettings();

  const rechnungen = invoices ?? [];
  const ausgaben = expenses ?? [];

  const jahre = useMemo(() => verfuegbareJahre(rechnungen, ausgaben), [rechnungen, ausgaben]);
  const [jahr, setJahr] = useState(() => new Date().getFullYear());

  const euer = useMemo(
    () => computeEuer(jahr, rechnungen, ausgaben),
    [jahr, rechnungen, ausgaben],
  );

  function exportPdf() {
    downloadEuerPdf(euer, company);
    toast.success(`EÜR ${jahr} als PDF exportiert`);
    logActivity({
      bereich: "EÜR",
      aktion: "PDF-Export",
      beschreibung: `EÜR ${jahr}: Gewinn ${EUR2(euer.gewinn)}`,
    });
  }

  const alleZeilen = [
    ...euer.einnahmen.map((z) => ({ ...z, art: "ein" as const })),
    ...euer.ausgaben.map((z) => ({ ...z, art: "aus" as const })),
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Einnahmen-Überschuss-Rechnung"
        description="Aggregiert bezahlte Rechnungen (Zufluss) und Ausgaben (Abfluss) nach Anlage-EÜR-Kategorien. Vorbereitung für Ihre Steuererklärung – Übertragung ans Finanzamt erfolgt über ELSTER."
        icon={ScrollText}
        badge="Steuer"
        right={
          <div className="flex items-center gap-2">
            <Select value={String(jahr)} onValueChange={(v) => setJahr(Number(v))}>
              <SelectTrigger className="w-28 border-white/30 bg-white/15 text-primary-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {jahre.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="secondary" onClick={exportPdf}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          label="Betriebseinnahmen"
          value={EUR2(euer.einnahmenSumme)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Betriebsausgaben"
          value={EUR2(euer.ausgabenSumme)}
          icon={TrendingDown}
          tone="warning"
        />
        <StatCard
          label={euer.gewinn >= 0 ? "Gewinn" : "Verlust"}
          value={EUR2(euer.gewinn)}
          icon={Euro}
          tone={euer.gewinn >= 0 ? "primary" : "warning"}
        />
      </section>

      <Card className="border-border/70 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Monatsaufstellung {jahr}</CardTitle>
          <Badge variant="secondary">Anlage EÜR</Badge>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs text-muted-foreground">
                <th className="px-2 py-2 text-left font-medium">Position</th>
                {MONATSNAMEN.map((m) => (
                  <th key={m} className="px-2 py-2 text-right font-medium tabular-nums">
                    {m}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-medium">Summe</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-success/5 text-xs">
                <td className="px-2 py-1.5 font-semibold text-success" colSpan={14}>
                  Betriebseinnahmen
                </td>
              </tr>
              {euer.einnahmen.map((z) => (
                <tr key={z.key} className="border-b border-border/40">
                  <td className="px-2 py-1.5">{z.label}</td>
                  {z.monate.map((v, i) => (
                    <td key={i} className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {v ? EUR2(v) : "—"}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {EUR2(z.summe)}
                  </td>
                </tr>
              ))}
              <tr className="bg-warning/5 text-xs">
                <td className="px-2 py-1.5 font-semibold text-warning" colSpan={14}>
                  Betriebsausgaben
                </td>
              </tr>
              {euer.ausgaben.map((z) => (
                <tr key={z.key} className="border-b border-border/40">
                  <td className="px-2 py-1.5">{z.label}</td>
                  {z.monate.map((v, i) => (
                    <td key={i} className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                      {v ? EUR2(v) : "—"}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                    {EUR2(z.summe)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border font-semibold">
                <td className="px-2 py-2">{euer.gewinn >= 0 ? "Gewinn" : "Verlust"}</td>
                <td className="px-2 py-2 text-right tabular-nums" colSpan={12} />
                <td className="px-2 py-2 text-right tabular-nums">{EUR2(euer.gewinn)}</td>
              </tr>
            </tbody>
          </table>
          {alleZeilen.every((z) => z.summe === 0) && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Für {jahr} liegen noch keine Zahlungseingänge oder Ausgaben vor.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
        <span className="font-semibold">Hinweis:</span> Im umsatzsteuerbefreiten Modus (§4 Nr.17b
        UStG) ist die Vorsteuer aus Ausgaben nicht abziehbar – Ausgaben werden brutto gebucht.
        Enthaltene, nicht abziehbare Vorsteuer {jahr}: {EUR2(euer.hinweisVorsteuer)}. {STEUER_DISCLAIMER}
      </div>
    </div>
  );
}
