// Auswahl einer ärztlichen Verordnung im Auftragsformular, inkl.
// Deckungsprüfung (rein informativ) und Schnellanlage ohne Seitenwechsel.
import { useMemo, useState } from "react";

import type { Transportart } from "@/lib/auftraege";
import { useOrders } from "@/lib/orders-store";
import { useVerordnungen, useCreateVerordnung } from "@/lib/verordnungen-store";
import { verordnungLabel, type VerordnungWrite } from "@/lib/verordnungen-shared";
import { pruefeDeckung, KEINE_VERORDNUNG_HINWEIS } from "@/lib/verordnung-deckung";
import { TRANSPORTARTEN } from "@/lib/auftraege";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NONE = "__none__";

interface Props {
  /** Aktuell im Formular verknüpfter Patient (Stammdaten-ID). */
  patientId: string | null | undefined;
  transportart: Transportart;
  /** Termin des Auftrags (datetime-local oder ISO). */
  termin: string;
  /** ID des bearbeiteten Auftrags (leer bei Neuanlage). */
  auftragId?: string;
  value: string | null | undefined;
  onChange: (verordnungId: string | null) => void;
}

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VerordnungAuswahl({
  patientId,
  transportart,
  termin,
  auftragId,
  value,
  onChange,
}: Props) {
  const { data: alleVerordnungen = [] } = useVerordnungen();
  const { data: auftraege = [] } = useOrders();
  const createVerordnung = useCreateVerordnung();
  const [dialogOffen, setDialogOffen] = useState(false);
  const [neu, setNeu] = useState<Partial<VerordnungWrite>>({
    ausstellungsdatum: heute(),
    transportart,
    istSerie: false,
  });

  // Nur Verordnungen des gewählten Patienten – sonst gäbe es keine
  // belastbare Zuordnung.
  const optionen = useMemo(
    () => (patientId ? alleVerordnungen.filter((v) => v.patientId === patientId) : []),
    [alleVerordnungen, patientId],
  );

  const gewaehlt = value ? (alleVerordnungen.find((v) => v.id === value) ?? null) : null;

  const deckung = useMemo(() => {
    if (!gewaehlt) return null;
    return pruefeDeckung(
      {
        id: auftragId ?? "\uffff", // Neuanlage zählt als letzte Fahrt des Tages
        termin: termin ? new Date(termin).toISOString() : new Date().toISOString(),
        transportart,
        status: "neu",
      },
      gewaehlt,
      auftraege.map((a) => ({
        id: a.id,
        termin: a.termin,
        transportart: a.transportart,
        status: a.status,
        verordnungId: a.verordnungId ?? null,
      })),
    );
  }, [gewaehlt, auftragId, termin, transportart, auftraege]);

  async function anlegen() {
    if (!patientId || !neu.ausstellungsdatum || !neu.transportart) return;
    const erstellt = await createVerordnung.mutateAsync({ ...neu, patientId });
    onChange(erstellt.id);
    setDialogOffen(false);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>Ärztliche Verordnung</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!patientId}
          onClick={() => {
            setNeu({ ausstellungsdatum: heute(), transportart, istSerie: false });
            setDialogOffen(true);
          }}
        >
          Neu anlegen
        </Button>
      </div>

      <Select
        value={value ?? NONE}
        onValueChange={(v) => onChange(v === NONE ? null : v)}
        disabled={!patientId}
      >
        <SelectTrigger>
          <SelectValue placeholder="Nicht verknüpft" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Nicht verknüpft</SelectItem>
          {optionen.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Keine Verordnung für diesen Patienten.
            </div>
          ) : (
            optionen.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {verordnungLabel(v)}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {!patientId && (
        <p className="text-xs text-muted-foreground">
          Bitte zuerst einen Patienten aus den Stammdaten verknüpfen.
        </p>
      )}

      {patientId && !gewaehlt && (
        <p className="text-xs text-muted-foreground">{KEINE_VERORDNUNG_HINWEIS}</p>
      )}

      {deckung && (
        <div
          className={
            deckung.gedeckt
              ? "rounded-xl border border-success/30 bg-success/10 p-3 text-xs"
              : "rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs"
          }
        >
          <p className="font-medium">
            {deckung.gedeckt ? "Durch Verordnung gedeckt" : "Nicht durch die Verordnung gedeckt"}
          </p>
          {deckung.grund && <p className="mt-1 text-muted-foreground">{deckung.grund}</p>}
          {deckung.genehmigt != null && deckung.verbraucht != null && (
            <p className="mt-1 text-muted-foreground">
              Fahrt {deckung.verbraucht} von {deckung.genehmigt} genehmigten Fahrten.
            </p>
          )}
          {!deckung.gedeckt && (
            <p className="mt-1 text-muted-foreground">
              Der Auftrag kann trotzdem gespeichert werden – bitte vor der Abrechnung klären.
            </p>
          )}
        </div>
      )}

      <Dialog open={dialogOffen} onOpenChange={setDialogOffen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Verordnung anlegen</DialogTitle>
            <DialogDescription>
              Nur Abrechnungsdaten der Verordnung – keine medizinischen Angaben.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="v-datum">Ausstellungsdatum</Label>
              <Input
                id="v-datum"
                type="date"
                value={neu.ausstellungsdatum ?? ""}
                onChange={(e) => setNeu((p) => ({ ...p, ausstellungsdatum: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Transportart</Label>
              <Select
                value={neu.transportart ?? transportart}
                onValueChange={(v) => setNeu((p) => ({ ...p, transportart: v as Transportart }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSPORTARTEN.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-arzt">Verordnender Arzt</Label>
              <Input
                id="v-arzt"
                value={neu.arztName ?? ""}
                onChange={(e) => setNeu((p) => ({ ...p, arztName: e.target.value }))}
                placeholder="Name der Praxis / des Arztes"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="v-bsnr">BSNR</Label>
                <Input
                  id="v-bsnr"
                  value={neu.arztBsnr ?? ""}
                  onChange={(e) => setNeu((p) => ({ ...p, arztBsnr: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-lanr">LANR</Label>
                <Input
                  id="v-lanr"
                  value={neu.arztLanr ?? ""}
                  onChange={(e) => setNeu((p) => ({ ...p, arztLanr: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <Label htmlFor="v-hin">Hin- und Rückfahrt</Label>
              <Switch
                id="v-hin"
                checked={neu.hinRueckfahrt ?? false}
                onCheckedChange={(c) => setNeu((p) => ({ ...p, hinRueckfahrt: c }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <Label htmlFor="v-serie">Serienverordnung</Label>
              <Switch
                id="v-serie"
                checked={neu.istSerie ?? false}
                onCheckedChange={(c) => setNeu((p) => ({ ...p, istSerie: c }))}
              />
            </div>
            {neu.istSerie && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="v-anzahl">Genehmigte Fahrten</Label>
                  <Input
                    id="v-anzahl"
                    type="number"
                    min={1}
                    value={neu.anzahlFaelligkeiten ?? ""}
                    onChange={(e) =>
                      setNeu((p) => ({
                        ...p,
                        anzahlFaelligkeiten: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="v-von">Gültig von</Label>
                    <Input
                      id="v-von"
                      type="date"
                      value={neu.seriengueltigVon ?? ""}
                      onChange={(e) =>
                        setNeu((p) => ({ ...p, seriengueltigVon: e.target.value || null }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="v-bis">Gültig bis</Label>
                    <Input
                      id="v-bis"
                      type="date"
                      value={neu.seriengueltigBis ?? ""}
                      onChange={(e) =>
                        setNeu((p) => ({ ...p, seriengueltigBis: e.target.value || null }))
                      }
                    />
                  </div>
                </div>
              </>
            )}
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <Label htmlFor="v-gen">Von der Kasse genehmigt</Label>
              <Switch
                id="v-gen"
                checked={neu.genehmigtVonKasse ?? false}
                onCheckedChange={(c) => setNeu((p) => ({ ...p, genehmigtVonKasse: c }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-gnr">Genehmigungsnummer</Label>
              <Input
                id="v-gnr"
                value={neu.genehmigungsnummer ?? ""}
                onChange={(e) => setNeu((p) => ({ ...p, genehmigungsnummer: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOffen(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={anlegen}
              disabled={createVerordnung.isPending || !neu.ausstellungsdatum}
            >
              Verordnung speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
