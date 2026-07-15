// AI Verordnungs-Scan dialog. Upload/photo a "Verordnung einer
// Krankenbeförderung" (Muster 4) → AI extracts the fields → the user reviews
// and edits EVERYTHING side-by-side with the scan → nothing is saved until an
// explicit confirmation. Also works as a plain upload + manual-entry path when
// the AI cannot recognise the fields.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ScanLine, Upload, Loader2, CheckCircle2, AlertTriangle, ArrowRight, UserPlus, UserCheck } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { usePatients, useCreatePatient, useUpdatePatient } from "@/lib/patients-store";
import { useInsurers } from "@/lib/insurers-store";
import { useUploadDocument } from "@/lib/documents-store";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/protokoll";
import type { PatientWrite } from "@/lib/patients-shared";
import { scanVerordnung } from "@/lib/verordnung-scan.functions";
import {
  emptyScan,
  findePatientMatch,
  findeKasseMatch,
  scanArtZuPatientMobilitaet,
  scanArtZuMobilitaet,
  scanArtZuTransportart,
  SCAN_ART_LABEL,
  type ScanTransportart,
  type ScannedVerordnung,
} from "@/lib/verordnung-scan-shared";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional preselected patient (from the patient page) – forces update mode. */
  patientId?: string;
}

type Step = "upload" | "confirm" | "done";

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ARTEN: ScanTransportart[] = ["Rollstuhl", "Tragestuhl", "liegend", "sitzend"];

export function VerordnungScanDialog({ open, onOpenChange, patientId }: Props) {
  const { name: akteur } = useAuth();
  const navigate = useNavigate();
  const scan = useServerFn(scanVerordnung);

  const { data: patienten = [] } = usePatients();
  const { data: kassen = [] } = useInsurers();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const uploadDoc = useUploadDocument();

  const [step, setStep] = useState<Step>("upload");
  const [datei, setDatei] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanFehler, setScanFehler] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Editable extracted values.
  const [values, setValues] = useState<ScannedVerordnung>(emptyScan);
  // "match" = update existing, "new" = create new patient.
  const [modus, setModus] = useState<"match" | "new">("new");
  const [zielPatientId, setZielPatientId] = useState<string | null>(null);
  const [gespeicherterName, setGespeicherterName] = useState("");
  const [gespeicherteMob, setGespeicherteMob] = useState<ScanTransportart | null>(null);

  const forcedPatient = useMemo(
    () => (patientId ? patienten.find((p) => p.id === patientId) ?? null : null),
    [patientId, patienten],
  );

  useEffect(() => {
    if (!open) return;
    // reset on open
    setStep("upload");
    setDatei(null);
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setScanFehler(null);
    setValues(emptyScan());
    setModus(forcedPatient ? "match" : "new");
    setZielPatientId(forcedPatient?.id ?? null);
  }, [open, forcedPatient]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const match = useMemo(
    () => (forcedPatient ? null : findePatientMatch(values.patientName, patienten)),
    [forcedPatient, values.patientName, patienten],
  );

  function pickFile(f: File | null) {
    setDatei(f);
    setScanFehler(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  async function runScan() {
    if (!datei) return;
    setScanning(true);
    setScanFehler(null);
    try {
      const base64 = await fileToBase64(datei);
      const res = await scan({ data: { imageBase64: base64, mimeType: datei.type || "image/jpeg" } });
      setValues(res.data);
      if (!res.ok) setScanFehler(res.fehler ?? "Erkennung fehlgeschlagen.");
      // Decide default mode from a fuzzy match.
      if (forcedPatient) {
        setModus("match");
        setZielPatientId(forcedPatient.id);
      } else {
        const m = findePatientMatch(res.data.patientName, patienten);
        setModus(m ? "match" : "new");
        setZielPatientId(m?.patient.id ?? null);
      }
      setStep("confirm");
    } catch (e) {
      setScanFehler(String(e));
    } finally {
      setScanning(false);
    }
  }

  function skipScan() {
    // Plain upload + manual entry path.
    setValues(emptyScan());
    setModus(forcedPatient ? "match" : "new");
    setZielPatientId(forcedPatient?.id ?? null);
    setStep("confirm");
  }

  const set = <K extends keyof ScannedVerordnung>(k: K, v: ScannedVerordnung[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  const busy = createPatient.isPending || updatePatient.isPending || uploadDoc.isPending;

  async function confirmSave() {
    const name = values.patientName?.trim();
    if (modus === "new" && !name) {
      toast.error("Bitte Patientennamen erfassen.");
      return;
    }
    if (modus === "match" && !zielPatientId) {
      toast.error("Bitte einen Patienten auswählen.");
      return;
    }
    try {
      const matchedKasse = findeKasseMatch(values.krankenkasse, kassen);
      const zielName =
        modus === "match"
          ? patienten.find((p) => p.id === zielPatientId)?.name ?? name ?? "Patient"
          : name!;

      // 1) Upload the scan into the document archive, linked to the patient.
      let dokumentId: string | null = null;
      if (datei) {
        const doc = await uploadDoc.mutateAsync({
          file: datei,
          kategorie: "rezept",
          ordner: `Patienten/${zielName}`,
          tags: ["verordnung", "muster4", ...(values.dauerfahrt ? ["dauerfahrt"] : [])],
          bezug: { typ: "patient", label: zielName },
        });
        dokumentId = doc.id;
      }

      // 2) Build the patient values from the confirmed fields.
      const patientValues: Partial<PatientWrite> = {
        versichertennummer: values.versichertennummer ?? undefined,
        verordnungVorhanden: true,
        verordnungDokumentId: dokumentId,
        genehmigungBis: values.gueltigBis ?? null,
        mobilitaet: scanArtZuPatientMobilitaet(values.transportart),
      };
      if (matchedKasse) {
        patientValues.kostentraeger = matchedKasse.name;
        patientValues.kostentraegerId = matchedKasse.id;
      } else if (values.krankenkasse) {
        patientValues.kostentraeger = values.krankenkasse;
      }

      if (modus === "match" && zielPatientId) {
        await updatePatient.mutateAsync({ id: zielPatientId, values: patientValues });
      } else {
        await createPatient.mutateAsync({
          name: name!,
          mobilitaet: patientValues.mobilitaet ?? "Gehfähig",
          kostentraeger: patientValues.kostentraeger ?? "",
          hinweis: values.arzt ? `Verordnender Arzt: ${values.arzt}` : "",
          begleitperson: false,
          ...patientValues,
        } as PatientWrite);
      }

      logActivity({
        bereich: "Patienten",
        aktion: modus === "match" ? "Verordnung erfasst" : "Neu (Scan)",
        beschreibung: `Verordnung (Muster 4) für „${zielName}" per Scan bestätigt`,
        entitaet: zielName,
      });
      toast.success(`Verordnung für „${zielName}" gespeichert`);
      setGespeicherterName(zielName);
      setGespeicherteMob(values.transportart);
      setStep("done");
    } catch (e) {
      toast.error("Speichern fehlgeschlagen", { description: String(e) });
    }
  }

  function goToAuftrag(ziel: "/auftraege" | "/dauerauftraege") {
    onOpenChange(false);
    navigate({
      to: ziel,
      search:
        ziel === "/auftraege"
          ? {
              neuPatient: gespeicherterName,
              neuMobilitaet: scanArtZuMobilitaet(gespeicherteMob),
              neuTransportart: scanArtZuTransportart(gespeicherteMob),
            }
          : {},
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" /> Verordnung scannen (Muster 4)
          </DialogTitle>
          <DialogDescription>
            Foto oder Scan hochladen – die KI liest die Felder aus. Nichts wird gespeichert, bevor Sie
            alle Angaben geprüft und bestätigt haben.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Verordnung (Foto/Scan)</Label>
              <Input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Vorschau der Verordnung"
                className="max-h-72 w-full rounded-xl border border-border/60 object-contain"
              />
            )}
            {scanFehler && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" /> {scanFehler}
              </p>
            )}
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button variant="ghost" onClick={skipScan} disabled={scanning}>
                Ohne Scan manuell erfassen
              </Button>
              <Button onClick={runScan} disabled={!datei || scanning}>
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
                Mit KI auslesen
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "confirm" && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Scan preview */}
            <div className="space-y-2">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Gescannte Verordnung"
                  className="max-h-[60vh] w-full rounded-xl border border-border/60 object-contain"
                />
              ) : (
                <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
                  Kein Bild – manuelle Erfassung
                </div>
              )}
              {scanFehler && (
                <p className="flex items-center gap-1.5 text-xs text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" /> {scanFehler} Bitte Felder manuell ausfüllen.
                </p>
              )}
            </div>

            {/* Editable fields */}
            <div className="space-y-3">
              {/* Patient target */}
              {!forcedPatient && (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  {match ? (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <UserCheck className="h-3.5 w-3.5" /> Möglicher Treffer (
                        {Math.round(match.score * 100)}% Übereinstimmung)
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant={modus === "match" ? "default" : "outline"}
                          onClick={() => {
                            setModus("match");
                            setZielPatientId(match.patient.id);
                          }}
                        >
                          <UserCheck className="h-3.5 w-3.5" /> {match.patient.name} aktualisieren
                        </Button>
                        <Button
                          size="sm"
                          variant={modus === "new" ? "default" : "outline"}
                          onClick={() => setModus("new")}
                        >
                          <UserPlus className="h-3.5 w-3.5" /> Neu anlegen
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <UserPlus className="h-3.5 w-3.5" /> Kein bestehender Patient erkannt – wird neu
                      angelegt.
                    </p>
                  )}
                </div>
              )}
              {forcedPatient && (
                <Badge variant="outline" className="border-info/30 bg-info/10 text-info">
                  <UserCheck className="mr-1 h-3.5 w-3.5" /> {forcedPatient.name} aktualisieren
                </Badge>
              )}

              <Feld label="Patientenname" wert={values.patientName}>
                <Input
                  value={values.patientName ?? ""}
                  onChange={(e) => set("patientName", e.target.value || null)}
                  placeholder="konnte nicht erkannt werden"
                />
              </Feld>
              <Feld label="Geburtsdatum" wert={values.geburtsdatum}>
                <Input
                  value={values.geburtsdatum ?? ""}
                  onChange={(e) => set("geburtsdatum", e.target.value || null)}
                  placeholder="konnte nicht erkannt werden"
                />
              </Feld>
              <Feld label="Krankenkasse" wert={values.krankenkasse}>
                <Input
                  value={values.krankenkasse ?? ""}
                  onChange={(e) => set("krankenkasse", e.target.value || null)}
                  placeholder="konnte nicht erkannt werden"
                />
              </Feld>
              <Feld label="Versichertennummer" wert={values.versichertennummer}>
                <Input
                  value={values.versichertennummer ?? ""}
                  onChange={(e) => set("versichertennummer", e.target.value || null)}
                  placeholder="konnte nicht erkannt werden"
                />
              </Feld>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Transportart</Label>
                  <Select
                    value={values.transportart ?? ""}
                    onValueChange={(v) => set("transportart", v as ScanTransportart)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="nicht erkannt" />
                    </SelectTrigger>
                    <SelectContent>
                      {ARTEN.map((a) => (
                        <SelectItem key={a} value={a}>
                          {SCAN_ART_LABEL[a]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border/60 px-3">
                  <Label className="text-xs">Dauerfahrt</Label>
                  <Switch
                    checked={Boolean(values.dauerfahrt)}
                    onCheckedChange={(c) => set("dauerfahrt", c)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Feld label="Gültig von" wert={values.gueltigVon}>
                  <Input
                    type="date"
                    value={values.gueltigVon ?? ""}
                    onChange={(e) => set("gueltigVon", e.target.value || null)}
                  />
                </Feld>
                <Feld label="Gültig bis" wert={values.gueltigBis}>
                  <Input
                    type="date"
                    value={values.gueltigBis ?? ""}
                    onChange={(e) => set("gueltigBis", e.target.value || null)}
                  />
                </Feld>
              </div>
              <Feld label="Verordnender Arzt" wert={values.arzt}>
                <Input
                  value={values.arzt ?? ""}
                  onChange={(e) => set("arzt", e.target.value || null)}
                  placeholder="konnte nicht erkannt werden"
                />
              </Feld>
            </div>

            <DialogFooter className="md:col-span-2 flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Zurück
              </Button>
              <Button onClick={confirmSave} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Bestätigen & speichern
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 rounded-xl bg-success/10 py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <p className="text-sm font-medium">Verordnung für „{gespeicherterName}" gespeichert.</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Optional: direkt eine Fahrt mit der erkannten Transportart vorbereiten.
              </p>
            </div>
            <DialogFooter className="flex-wrap gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fertig
              </Button>
              <Button variant="secondary" onClick={() => goToAuftrag("/dauerauftraege")}>
                Dauerauftrag <ArrowRight className="h-4 w-4" />
              </Button>
              <Button onClick={() => goToAuftrag("/auftraege")}>
                Auftrag anlegen <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Feld({
  label,
  wert,
  children,
}: {
  label: string;
  wert: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {!wert && (
          <span className="text-[10px] text-warning">nicht erkannt</span>
        )}
      </div>
      {children}
    </div>
  );
}
