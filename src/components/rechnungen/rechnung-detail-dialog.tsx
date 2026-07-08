import { useState } from "react";
import { toast } from "sonner";
import { History, Plus, Trash2, Wallet } from "lucide-react";

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
import {
  type Rechnung,
  type Zahlung,
  EUR2,
  brutto,
  summeZahlungen,
  offenerBetrag,
  abgeleiteterStatus,
  formatDatum,
  RECHNUNG_STATUS_META,
} from "@/lib/finance";
import { useInvoiceChanges, useUpdateInvoice } from "@/lib/invoices-store";
import { toISODate } from "@/lib/shifts-shared";
import { logActivity } from "@/lib/protokoll";

interface Props {
  rechnung: Rechnung | null;
  onClose: () => void;
}

export function RechnungDetailDialog({ rechnung, onClose }: Props) {
  const updateMut = useUpdateInvoice();
  const { data: changes } = useInvoiceChanges(rechnung?.id ?? null);

  const [datum, setDatum] = useState(() => toISODate(new Date()));
  const [betrag, setBetrag] = useState("");
  const [notiz, setNotiz] = useState("");

  if (!rechnung) return null;

  const zahlungen = rechnung.zahlungen ?? [];
  const gezahlt = summeZahlungen(rechnung);
  const offen = offenerBetrag(rechnung);

  async function speichereZahlungen(next: Zahlung[]) {
    if (!rechnung) return;
    const neuerStatus = abgeleiteterStatus({ ...rechnung, zahlungen: next });
    const summe = next.reduce((s, z) => s + z.betrag, 0);
    const letzte = next.map((z) => z.datum).sort().at(-1) ?? null;
    await updateMut.mutateAsync({
      id: rechnung.id,
      values: {
        zahlungen: next,
        status: neuerStatus,
        bezahlterBetrag: summe,
        bezahltAm: neuerStatus === "bezahlt" ? letzte : null,
      },
    });
  }

  async function addZahlung() {
    const wert = Number(betrag.replace(",", "."));
    if (!Number.isFinite(wert) || wert === 0) {
      toast.error("Bitte einen gültigen Betrag eingeben");
      return;
    }
    if (!rechnung) return;
    const next = [...zahlungen, { datum, betrag: wert, notiz: notiz || undefined }];
    try {
      await speichereZahlungen(next);
      setBetrag("");
      setNotiz("");
      toast.success("Zahlung erfasst");
      logActivity({
        bereich: "Rechnungen",
        aktion: "Zahlung erfasst",
        beschreibung: `${rechnung.nummer}: ${EUR2(wert)} am ${formatDatum(datum)}`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  async function removeZahlung(i: number) {
    const next = zahlungen.filter((_, idx) => idx !== i);
    try {
      await speichereZahlungen(next);
      toast.success("Zahlung entfernt");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Speichern");
    }
  }

  const statusMeta = RECHNUNG_STATUS_META[abgeleiteterStatus(rechnung)];

  return (
    <Dialog open={!!rechnung} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {rechnung.nummer}
            <Badge variant="outline" className={`text-[10px] ${statusMeta.badge}`}>
              {statusMeta.label}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {rechnung.kunde} · Gesamtbetrag {EUR2(brutto(rechnung))}
          </DialogDescription>
        </DialogHeader>

        {/* Zahlungen */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="h-4 w-4" /> Zahlungen
          </h3>
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Bezahlt</p>
              <p className="font-semibold tabular-nums">{EUR2(gezahlt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Offen</p>
              <p className="font-semibold tabular-nums">{EUR2(offen)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gesamt</p>
              <p className="font-semibold tabular-nums">{EUR2(brutto(rechnung))}</p>
            </div>
          </div>

          {zahlungen.length > 0 && (
            <div className="space-y-1.5">
              {zahlungen.map((z, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium tabular-nums">{EUR2(z.betrag)}</span>
                    <span className="ml-2 text-muted-foreground">{formatDatum(z.datum)}</span>
                    {z.notiz && <span className="ml-2 text-xs text-muted-foreground">· {z.notiz}</span>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => removeZahlung(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
            <div className="space-y-1">
              <Label className="text-xs">Datum</Label>
              <Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Betrag (€)</Label>
              <Input
                inputMode="decimal"
                placeholder={String(offen)}
                value={betrag}
                onChange={(e) => setBetrag(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Referenz (optional)</Label>
              <Input value={notiz} onChange={(e) => setNotiz(e.target.value)} />
            </div>
            <Button onClick={addZahlung} disabled={updateMut.isPending}>
              <Plus className="h-4 w-4" /> Erfassen
            </Button>
          </div>
        </section>

        {/* Änderungshistorie */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <History className="h-4 w-4" /> Änderungshistorie
          </h3>
          {!changes || changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Änderungen protokolliert.</p>
          ) : (
            <div className="space-y-1.5">
              {changes.map((c) => (
                <div
                  key={c.id}
                  className="rounded-lg border border-border/50 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.feld}</span>
                    <span className="text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString("de-DE")}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    <span className="line-through">{c.altWert ?? "—"}</span> →{" "}
                    <span className="text-foreground">{c.neuWert ?? "—"}</span>
                    {c.akteur && <span className="ml-1">· {c.akteur}</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] italic text-muted-foreground">
            Hinweis: Die offizielle Buchführung sollte über Steuerberater/DATEV erfolgen. Diese
            Historie dient der internen Nachvollziehbarkeit (GoBD-orientiert).
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
