import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3, Download, Printer, FileSpreadsheet } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/protokoll";
import {
  BERICHT_LISTE,
  buildBericht,
  downloadCSV,
  druckeBericht,
  type BerichtTyp,
} from "@/lib/reporting";

export const Route = createFileRoute("/berichte")({
  head: () => ({
    meta: [
      { title: "Berichte – GHASI AI" },
      { name: "description", content: "Operative und finanzielle Reports auf Knopfdruck – Export als PDF, Excel und CSV." },
    ],
  }),
  component: BerichtePage,
});

function BerichtePage() {
  const [typ, setTyp] = useState<BerichtTyp>("umsatz");
  const bericht = useMemo(() => buildBericht(typ), [typ]);

  const exportCSV = () => {
    downloadCSV(bericht);
    logActivity({
      bereich: "Berichte",
      aktion: "Export",
      beschreibung: `${bericht.titel} als CSV/Excel exportiert`,
      entitaet: bericht.typ,
    });
  };

  const exportPDF = () => {
    druckeBericht(bericht);
    logActivity({
      bereich: "Berichte",
      aktion: "Export",
      beschreibung: `${bericht.titel} als PDF gedruckt`,
      entitaet: bericht.typ,
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Berichte"
        description="Operative und finanzielle Reports auf Knopfdruck – direkt aus den Live-Daten erzeugt und als PDF, Excel oder CSV exportierbar."
        icon={BarChart3}
        badge="Reporting"
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {/* Berichtsauswahl */}
        <Card className="border-border/70 shadow-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Berichtstypen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {BERICHT_LISTE.map((b) => (
              <button
                key={b.typ}
                type="button"
                onClick={() => setTyp(b.typ)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  typ === b.typ
                    ? "border-primary bg-primary/5"
                    : "border-border/60 bg-card hover:bg-muted/50",
                )}
              >
                <p className="text-sm font-medium">{b.titel}</p>
                <p className="text-xs leading-snug text-muted-foreground">{b.beschreibung}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Berichtsanzeige */}
        <Card className="border-border/70 shadow-card lg:col-span-3">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">{bericht.titel}</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">{bericht.beschreibung}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={exportPDF}>
                <Printer className="h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={exportCSV}>
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button size="sm" className="rounded-full" onClick={exportCSV}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {bericht.spalten.map((s) => (
                      <TableHead key={s}>{s}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bericht.zeilen.map((z, i) => (
                    <TableRow key={i}>
                      {z.map((c, j) => (
                        <TableCell key={j} className={j === 0 ? "font-medium" : "text-muted-foreground"}>
                          {c}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {bericht.summe && (
                    <TableRow className="border-t-2 border-border font-semibold">
                      {bericht.summe.map((c, j) => (
                        <TableCell key={j}>{c}</TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
