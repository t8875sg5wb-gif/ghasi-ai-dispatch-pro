// Auswahl einer ärztlichen Verordnung im Auftragsformular, inkl.
// Deckungsprüfung (rein informativ), Schnellanlage und Bearbeitung ohne
// Seitenwechsel. Es wird nie geraten: fehlt der Patient oder ein gültiger
// Termin, sagt die Komponente das ausdrücklich.
import { useEffect, useMemo, useState } from "react";

import type { Transportart } from "@/lib/auftraege";
import { useOrders } from "@/lib/orders-store";
import { useVerordnungen, useCreateVerordnung, useUpdateVerordnung } from "@/lib/verordnungen-store";
import { verordnungLabel, type Verordnung, type VerordnungWrite } from "@/lib/verordnungen-shared";
import {
  pruefeDeckung,
  zeitstempel,
  KEINE_VERORDNUNG_HINWEIS,
  KEIN_TERMIN_HINWEIS,
} from "@/lib/verordnung-deckung";
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

/** Neuanlagen haben noch keine ID – ein stabiler Platzhalter genügt. */
const NEUER_AUFTRAG_ID = "__neuer-auftrag__";

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
  const updateVerordnung = useUpdateVerordnung();
  const [dialogModus, setDialogModus] = useState<"neu" | "bearbeiten" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState<Partial<VerordnungWrite>>({
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

  const gewaehlt: Verordnung | null = value
    ? (alleVerordnungen.find((v) => v.id === value) ?? null)
    : null;

  // Verordnung gehört zu einem anderen Patienten oder ist nicht (mehr) lesbar.
  const konflikt = Boolean(value) && (!gewaehlt || gewaehlt.patientId !== (patientId ?? null));

  // Konflikte werden nicht stillschweigend repariert, aber auch nicht
  // gespeichert: die Verknüpfung wird sichtbar entfernt.
  useEffect(() => {
    if (value && gewaehlt && patientId && gewaehlt.patientId !== patientId) {
      onChange(null);
    }
  }, [value, gewaehlt, patientId, onChange]);

  const terminMs = zeitstempel(termin);

  const deckung = useMemo(() => {
    if (!gewaehlt || konflikt) return null;
    return pruefeDeckung(
      {
        id: auftragId ?? NEUER_AUFTRAG_ID,
        termin: termin,
        transportart,
        status: "neu",
        verordnungId: gewaehlt.id,
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
  }, [gewaehlt, konflikt, auftragId, termin, transportart, auftraege]);

  function oeffneNeu() {
    setFehler(null);
    setEntwurf({ ausstellungsdatum: heute(), transportart, istSerie: false });
    setDialogModus("neu");
  }

  function oeffneBearbeiten() {
    if (!gewaehlt) return;
    setFehler(null);
    const { id: _id, ...rest } = gewaehlt;
    setEntwurf(rest);
    setDialogModus("bearbeiten");
  }

  async function speichern() {
    setFehler(null);
    if (!patientId || !entwurf.ausstellungsdatum || !entwurf.transportart) return;
    if (
      entwurf.seriengueltigVon &&
      entwurf.seriengueltigBis &&
      entwurf.seriengueltigVon > entwurf.seriengueltigBis
    ) {
      setFehler("Serienzeitraum: „von“ darf nicht nach „bis“ liegen.");
      return;
    }
    try {
      if (dialogModus === "bearbeiten" && gewaehlt) {
        await updateVerordnung.mutateAsync({
          id: gewaehlt.id,
          values: { ...entwurf, patientId },
        });
      } else {
        const erstellt = await createVerordnung.mutateAsync({ ...entwurf, patientId });
        onChange(erstellt.id);
      }
      setDialogModus(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    }
  }

  const speichertGerade = createVerordnung.isPending || updateVerordnung.isPending;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>Ärztliche Verordnung</Label>
        <div className="flex items-center gap-1">
          {gewaehlt && !konflikt && (
            <Button type="button" variant="ghost" size="sm" onClick={oeffneBearbeiten}>
              Bearbeiten
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!patientId}
            onClick={oeffneNeu}
          >
            Neu anlegen
          </Button>
        </div>
      </div>

      <Select
        value={gewaehlt && !konflikt ? gewaehlt.id : NONE}
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

      {konflikt && (
        <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs">
          Die bisher verknüpfte Verordnung gehört nicht zu diesem Patienten und wurde entfernt.
          Bitte eine passende Verordnung auswählen.
        </p>
      )}

      {patientId && !gewaehlt && !konflikt && (
        <p className="text-xs text-muted-foreground">{KEINE_VERORDNUNG_HINWEIS}</p>
      )}

      {gewaehlt && !konflikt && terminMs === null && (
        <p className="text-xs text-muted-foreground">{KEIN_TERMIN_HINWEIS}</p>
      )}

      {deckung && terminMs !== null && (
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

      <Dialog open={dialogModus !== null} onOpenChange={(o) => !o && setDialogModus(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogModus === "bearbeiten" ? "Verordnung bearbeiten" : "Verordnung anlegen"}
            </DialogTitle>
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
                value={entwurf.ausstellungsdatum ?? ""}
                onChange={(e) =>
                  setEntwurf((p) => ({ ...p, ausstellungsdatum: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Transportart</Label>
              <Select
                value={entwurf.transportart ?? transportart}
                onValueChange={(v) =>
                  setEntwurf((p) => ({ ...p, transportart: v as Transportart }))
                }
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
                value={entwurf.arztName ?? ""}
                onChange={(e) => setEntwurf((p) => ({ ...p, arztName: e.target.value }))}
                placeholder="Name der Praxis / des Arztes"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="v-bsnr">BSNR</Label>
                <Input
                  id="v-bsnr"
                  value={entwurf.arztBsnr ?? ""}
                  onChange={(e) => setEntwurf((p) => ({ ...p, arztBsnr: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-lanr">LANR</Label>
                <Input
                  id="v-lanr"
                  value={entwurf.arztLanr ?? ""}
                  onChange={(e) => setEntwurf((p) => ({ ...p, arztLanr: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <Label htmlFor="v-hin">Hin- und Rückfahrt</Label>
              <Switch
                id="v-hin"
                checked={entwurf.hinRueckfahrt ?? false}
                onCheckedChange={(c) => setEntwurf((p) => ({ ...p, hinRueckfahrt: c }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <Label htmlFor="v-serie">Serienverordnung</Label>
              <Switch
                id="v-serie"
                checked={entwurf.istSerie ?? false}
                onCheckedChange={(c) => setEntwurf((p) => ({ ...p, istSerie: c }))}
              />
            </div>
            {entwurf.istSerie && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="v-anzahl">Genehmigte Fahrten</Label>
                  <Input
                    id="v-anzahl"
                    type="number"
                    min={1}
                    value={entwurf.anzahlFaelligkeiten ?? ""}
                    onChange={(e) =>
                      setEntwurf((p) => ({
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
                      value={entwurf.seriengueltigVon ?? ""}
                      onChange={(e) =>
                        setEntwurf((p) => ({ ...p, seriengueltigVon: e.target.value || null }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="v-bis">Gültig bis</Label>
                    <Input
                      id="v-bis"
                      type="date"
                      value={entwurf.seriengueltigBis ?? ""}
                      onChange={(e) =>
                        setEntwurf((p) => ({ ...p, seriengueltigBis: e.target.value || null }))
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
                checked={entwurf.genehmigtVonKasse ?? false}
                onCheckedChange={(c) => setEntwurf((p) => ({ ...p, genehmigtVonKasse: c }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="v-gnr">Genehmigungsnummer</Label>
              <Input
                id="v-gnr"
                value={entwurf.genehmigungsnummer ?? ""}
                onChange={(e) => setEntwurf((p) => ({ ...p, genehmigungsnummer: e.target.value }))}
              />
            </div>
            {fehler && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs sm:col-span-2">
                {fehler}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogModus(null)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              onClick={speichern}
              disabled={speichertGerade || !entwurf.ausstellungsdatum}
            >
              Verordnung speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
