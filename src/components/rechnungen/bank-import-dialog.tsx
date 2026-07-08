// CSV/XLSX bank-statement import for the invoices page. Parses a bank export,
// suggests matches to open invoices (by amount and/or invoice number in the
// reference) and records the payment via the existing payment logic on confirm.
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle2, Link2, Banknote } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/protokoll";
import { parseSpreadsheet } from "@/lib/import-parse";
import { bankBuchungen, matcheBuchungen, type BankMatch } from "@/lib/bank-import";
import {
  type Rechnung,
  type Zahlung,
  abgeleiteterStatus,
  offenerBetrag,
  formatDatum,
} from "@/lib/finance";
import { useInvoices, useUpdateInvoice } from "@/lib/invoices-store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export function BankImportDialog({ open, onOpenChange }: Props) {
  const { data: rechnungen = [] } = useInvoices();
  const updateMut = useUpdateInvoice();
  const fileRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [matches, setMatches] = useState<BankMatch[] | null>(null);
  const [erledigt, setErledigt] = useState<Set<number>>(new Set());
  const [busyIdx, setBusyIdx] = useState<number | null>(null);

  const offene = useMemo(
    () =>
      rechnungen.filter(
        (r) =>
          r.typ === "rechnung" &&
          !["storniert", "entwurf"].includes(r.status) &&
          offenerBetrag(r) > 0,
      ),
    [rechnungen],
  );

  async function onFile(file: File | null) {
    if (!file) return;
    setParsing(true);
    setMatches(null);
    setErledigt(new Set());
    try {
      const sheet = await parseSpreadsheet(file);
      const buchungen = bankBuchungen(sheet);
      if (buchungen.length === 0) {
        toast.error("Keine Zahlungseingänge in der Datei gefunden.");
        return;
      }
      setMatches(matcheBuchungen(buchungen, offene));
    } catch (e) {
      toast.error("Datei konnte nicht gelesen werden", { description: String(e) });
    } finally {
      setParsing(false);
    }
  }

  async function recordPayment(idx: number, m: BankMatch) {
    if (!m.kandidat) return;
    const r: Rechnung = m.kandidat;
    const next: Zahlung[] = [
      ...(r.zahlungen ?? []),
      {
        datum: m.buchung.datum,
        betrag: m.buchung.betrag,
        notiz: `Bankimport: ${m.buchung.referenz}`.slice(0, 180),
      },
    ];
    const neuerStatus = abgeleiteterStatus({ ...r, zahlungen: next });
    const summe = next.reduce((s, z) => s + z.betrag, 0);
    const letzte = next.map((z) => z.datum).sort().at(-1) ?? null;
    setBusyIdx(idx);
    try {
      await updateMut.mutateAsync({
        id: r.id,
        values: {
          zahlungen: next,
          status: neuerStatus,
          bezahlterBetrag: summe,
          bezahltAm: neuerStatus === "bezahlt" ? letzte : null,
        },
      });
      logActivity({
        bereich: "Buchhaltung",
        aktion: "Zahlungseingang (Bankimport)",
        beschreibung: `${euro(m.buchung.betrag)} auf ${r.nummer} verbucht`,
        entitaet: r.nummer,
      });
      toast.success(`${euro(m.buchung.betrag)} auf ${r.nummer} verbucht`);
      setErledigt((prev) => new Set(prev).add(idx));
    } catch (e) {
      toast.error("Verbuchen fehlgeschlagen", { description: String(e) });
    } finally {
      setBusyIdx(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" /> Kontoauszug importieren
          </DialogTitle>
          <DialogDescription>
            CSV/XLSX-Export der Bank hochladen – Zahlungseingänge werden offenen Rechnungen
            zugeordnet (Betrag &amp; Rechnungsnummer im Verwendungszweck).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Kontoauszug (CSV oder XLSX)</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {parsing && (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Datei wird analysiert …
            </p>
          )}

          {matches && matches.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {matches.length} Zahlungseingänge · {offene.length} offene Rechnungen
              </p>
              {matches.map((m, idx) => {
                const done = erledigt.has(idx);
                return (
                  <div
                    key={idx}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3",
                      done && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold tabular-nums">{euro(m.buchung.betrag)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDatum(m.buchung.datum)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{m.buchung.referenz}</p>
                    </div>

                    <div className="min-w-0 flex-1">
                      {m.kandidat ? (
                        <div className="flex items-center gap-1.5">
                          <Link2 className="h-3.5 w-3.5 text-primary" />
                          <span className="text-sm font-medium">{m.kandidat.nummer}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              m.score >= 0.9
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-warning/30 bg-warning/10 text-warning",
                            )}
                          >
                            {Math.round(m.score * 100)}%
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Kein Treffer</span>
                      )}
                      {m.kandidat && (
                        <p className="truncate text-[11px] text-muted-foreground">{m.grund}</p>
                      )}
                    </div>

                    {done ? (
                      <Badge className="border-success/30 bg-success/10 text-success">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Verbucht
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={!m.kandidat || busyIdx === idx}
                        onClick={() => recordPayment(idx, m)}
                      >
                        {busyIdx === idx ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Verbuchen
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {matches && matches.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Keine Zahlungseingänge gefunden.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
