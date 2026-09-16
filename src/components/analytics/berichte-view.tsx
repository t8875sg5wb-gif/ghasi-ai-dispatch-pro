import { useState } from "react";
import { AlertTriangle, BarChart3, Download, Printer, FileSpreadsheet } from "lucide-react";

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
  berichtGrundlage,
  buildBericht,
  downloadCSV,
  druckeBericht,
  type BerichtTyp,
} from "@/lib/reporting";
import { useInvoices } from "@/lib/invoices-store";
import { useVehicles } from "@/lib/vehicles-store";
import { useDrivers } from "@/lib/drivers-store";
import { useOrders } from "@/lib/orders-store";
import { useCustomers } from "@/lib/customers-store";
import { usePatients } from "@/lib/patients-store";

export function BerichtePage() {
  const [typ, setTyp] = useState<BerichtTyp>("umsatz");
  // buildBericht() liest die modulweiten Legacy-Spiegel (INITIAL_RECHNUNGEN
  // etc.) direkt statt über Parameter. Diese Seite rief bisher KEINEN
  // Hydrations-Hook auf und der useMemo hing nur an `typ` – ein Bericht
  // konnte dadurch dauerhaft auf dem Stand von vor dem ersten erfolgreichen
  // Laden "einfrieren" (z. B. leer bleiben), selbst nachdem die echten Daten
  // an anderer Stelle im Baum längst geladen waren. Die Hooks unten lösen
  // die Hydration selbst aus und ihre Daten in der Dependency-Liste sorgen
  // dafür, dass der Bericht neu berechnet wird, sobald echte Daten da sind.
  const invoicesQ = useInvoices();
  const vehiclesQ = useVehicles();
  const driversQ = useDrivers();
  const ordersQ = useOrders();
  const customersQ = useCustomers();
  const patientsQ = usePatients();
  const bereit =
    invoicesQ.data !== undefined &&
    vehiclesQ.data !== undefined &&
    driversQ.data !== undefined &&
    ordersQ.data !== undefined &&
    customersQ.data !== undefined &&
    patientsQ.data !== undefined;
  const daten = {
    rechnungen: invoicesQ.data ?? [],
    fahrzeuge: vehiclesQ.data ?? [],
    fahrer: driversQ.data ?? [],
    auftraege: ordersQ.data ?? [],
    kunden: customersQ.data ?? [],
    patienten: patientsQ.data ?? [],
  };
  const bericht = buildBericht(typ, daten);
  const grundlage = bereit
    ? berichtGrundlage(typ, daten)
    : { vorhanden: false, hinweis: "Daten werden noch geladen." };

  const exportCSV = () => {
    downloadCSV(bericht, grundlage);
    logActivity({
      bereich: "Berichte",
      aktion: "Export",
      beschreibung: `${bericht.titel} als CSV/Excel exportiert`,
      entitaet: bericht.typ,
    });
  };

  const exportPDF = () => {
    druckeBericht(bericht, grundlage);
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
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={exportPDF}
                disabled={!grundlage.vorhanden}
              >
                <Printer className="h-4 w-4" /> PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={exportCSV}
                disabled={!grundlage.vorhanden}
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button
                size="sm"
                className="rounded-full"
                onClick={exportCSV}
                disabled={!grundlage.vorhanden}
              >
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!grundlage.vorhanden ? (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div>
                  <p className="font-medium text-foreground">Keine belastbare Datenbasis</p>
                  <p>{grundlage.hinweis}</p>
                  <p className="mt-1 text-xs">PDF-/CSV-/Excel-Export ist bis dahin gesperrt.</p>
                </div>
              </div>
            ) : (
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
                          <TableCell
                            key={j}
                            className={j === 0 ? "font-medium" : "text-muted-foreground"}
                          >
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
