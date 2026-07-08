import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { HeartPulse, Phone, Search, Shield, UserCheck, FileText, Plus } from "lucide-react";

import { type Patient } from "@/lib/stammdaten";
import {
  usePatients,
  useSeedPatients,
  useCreatePatient,
  useUpdatePatient,
} from "@/lib/patients-store";
import type { PatientWrite } from "@/lib/patients-shared";
import { Button } from "@/components/ui/button";
import {
  INITIAL_AUFTRAEGE,
  MOBILITAET_META,
  VERORDNUNG_META,
  STATUS_META,
  effektiveVerordnung,
  formatTermin,
  type Mobilitaet,
} from "@/lib/auftraege";
import { MedizinBadges, fahrzeugMismatch } from "@/components/auftraege/medizin-details";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { logActivity } from "@/lib/protokoll";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/patienten")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Patienten – GHASI AI" },
      { name: "description", content: "Patientenakten, Mobilität und Transportbedarf verwalten." },
    ],
  }),
  component: PatientenSeite,
});

const MOBILITAETEN: Patient["mobilitaet"][] = ["Gehfähig", "Rollstuhl", "Liegend"];

/** Übersetzt das Stammdaten-Mobilitätslabel in den feineren Mobilitäts-Typ. */
function mobilitaetTyp(p: Patient): Mobilitaet {
  switch (p.mobilitaet) {
    case "Rollstuhl":
      return "rollstuhl";
    case "Liegend":
      return "liegend";
    default:
      return "gehfaehig";
  }
}

function PatientenSeite() {
  const { name: akteur } = useAuth();
  const { data: patienten = [] } = usePatients();
  const seedMut = useSeedPatients();
  const createMut = useCreatePatient();
  const updateMut = useUpdatePatient();
  const [suche, setSuche] = useState("");
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Patient | null>(null);

  const gefiltert = patienten.filter(
    (p) =>
      p.name.toLowerCase().includes(suche.toLowerCase()) ||
      p.kostentraeger.toLowerCase().includes(suche.toLowerCase()),
  );
  const patient = patienten.find((p) => p.id === aktiv) ?? gefiltert[0] ?? null;

  function speichern(values: PatientWrite) {
    const istNeu = !editTarget;
    const onDone = (msg: string) => {
      setFormOpen(false);
      setEditTarget(null);
      logActivity({
        bereich: "Patienten",
        entitaet: values.name,
        aktion: istNeu ? "angelegt" : "bearbeitet",
        beschreibung: `Patient „${values.name}“ wurde ${istNeu ? "angelegt" : "aktualisiert"}.`,
        akteur,
      });
      toast.success(msg);
    };
    if (istNeu) {
      createMut.mutate(values, {
        onSuccess: (row) => {
          setAktiv(row.id);
          onDone("Patient angelegt");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen"),
      });
    } else {
      updateMut.mutate(
        { id: editTarget.id, values },
        {
          onSuccess: () => {
            setAktiv(editTarget.id);
            onDone("Patient gespeichert");
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen"),
        },
      );
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HeartPulse className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Patienten</h1>
            <p className="text-sm text-muted-foreground">
              Patientenakten, Mobilität, Verordnung und Transportbedarf.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {patienten.length === 0 && (
            <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
              Beispieldaten laden
            </Button>
          )}
          <Button
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Patient anlegen
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Liste */}
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Patient suchen…"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {gefiltert.map((p) => {
              const mob = MOBILITAET_META[mobilitaetTyp(p)];
              return (
                <button
                  key={p.id}
                  onClick={() => setAktiv(p.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    patient?.id === p.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.name}</span>
                    <Badge className={cn("gap-1 text-[10px]", mob.badge)}>
                      <mob.icon className="h-3 w-3" />
                      {mob.kurz}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.kostentraeger}</p>
                </button>
              );
            })}
            {gefiltert.length === 0 && (
              <p className="px-1 py-4 text-sm text-muted-foreground">Keine Treffer.</p>
            )}
          </CardContent>
        </Card>

        {/* Profil */}
        {patient && (
          <PatientProfil
            patient={patient}
            onEdit={() => {
              setEditTarget(patient);
              setFormOpen(true);
            }}
          />
        )}
      </div>

      <PatientForm
        open={formOpen}
        target={editTarget}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSave={speichern}
        saving={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}

function PatientProfil({ patient, onEdit }: { patient: Patient; onEdit: () => void }) {
  const mob = MOBILITAET_META[mobilitaetTyp(patient)];
  const transporte = INITIAL_AUFTRAEGE.filter((a) => a.patient === patient.name);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>{patient.name}</span>
            <span className="flex items-center gap-2">
              <Badge className={cn("gap-1", mob.badge)}>
                <mob.icon className="h-3.5 w-3.5" />
                {mob.label}
              </Badge>
              <Button variant="outline" size="sm" onClick={onEdit}>
                Bearbeiten
              </Button>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfilZeile icon={Shield} label="Kostenträger" value={patient.kostentraeger} />
            <ProfilZeile
              icon={Phone}
              label="Telefon"
              value={patient.telefon?.trim() ? patient.telefon : "—"}
            />
            <ProfilZeile
              icon={UserCheck}
              label="Begleitperson"
              value={patient.begleitperson ? "Ja – standardmäßig" : "Nein"}
            />
          </div>
          {patient.hinweis && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Hinweis</p>
              <p className="text-sm">{patient.hinweis}</p>
            </div>
          )}
          {patient.medizinischeNotiz && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
              <p className="text-xs font-medium text-warning">Medizinische Notiz</p>
              <p className="text-sm">{patient.medizinischeNotiz}</p>
            </div>
          )}
          {patient.patientennotiz && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Patientennotiz</p>
              <p className="text-sm">{patient.patientennotiz}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Transporte & Verordnungen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {transporte.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Transporte erfasst.</p>
          )}
          {transporte.map((a) => {
            const ver = VERORDNUNG_META[effektiveVerordnung(a)];
            const mismatch = fahrzeugMismatch(a);
            return (
              <div key={a.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{a.nummer}</span>
                  <Badge variant="outline" className={cn("gap-1", STATUS_META[a.status].badge)}>
                    {STATUS_META[a.status].label}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {a.abholort} → {a.zielort} · {formatTermin(a.termin)}
                </p>
                <MedizinBadges auftrag={a} className="mt-2" />
                <div className="mt-2 flex items-center gap-1 text-xs">
                  <ver.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Verordnung:</span>
                  <span className="font-medium">{ver.label}</span>
                </div>
                {mismatch && <p className="mt-1 text-xs font-medium text-warning">{mismatch}</p>}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfilZeile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Shield;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function PatientForm({
  open,
  target,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  target: Patient | null;
  onClose: () => void;
  onSave: (values: PatientWrite) => void;
  saving: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target ? "Patient bearbeiten" : "Patient anlegen"}</DialogTitle>
          <DialogDescription>
            Stammdaten, Mobilität und medizinische Hinweise für Disposition und Fahrer.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <PatientFelder target={target} onClose={onClose} onSave={onSave} saving={saving} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PatientFelder({
  target,
  onClose,
  onSave,
  saving,
}: {
  target: Patient | null;
  onClose: () => void;
  onSave: (values: PatientWrite) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(target?.name ?? "");
  const [telefon, setTelefon] = useState(target?.telefon ?? "");
  const [mobilitaet, setMobilitaet] = useState<Patient["mobilitaet"]>(
    target?.mobilitaet ?? "Gehfähig",
  );
  const [kostentraeger, setKostentraeger] = useState(target?.kostentraeger ?? "");
  const [hinweis, setHinweis] = useState(target?.hinweis ?? "");
  const [begleitperson, setBegleitperson] = useState(target?.begleitperson ?? false);
  const [medizinischeNotiz, setMedizinischeNotiz] = useState(target?.medizinischeNotiz ?? "");
  const [patientennotiz, setPatientennotiz] = useState(target?.patientennotiz ?? "");

  function submit() {
    if (!name.trim()) {
      toast.error("Name ist erforderlich.");
      return;
    }
    onSave({
      name: name.trim(),
      telefon: telefon.trim() || undefined,
      mobilitaet,
      kostentraeger: kostentraeger.trim(),
      hinweis: hinweis.trim(),
      begleitperson,
      medizinischeNotiz: medizinischeNotiz.trim() || undefined,
      patientennotiz: patientennotiz.trim() || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <Feld label="Name *">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Feld>
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Mobilität">
          <Select
            value={mobilitaet}
            onValueChange={(v) => setMobilitaet(v as Patient["mobilitaet"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOBILITAETEN.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Feld>
        <Feld label="Telefon">
          <Input value={telefon} onChange={(e) => setTelefon(e.target.value)} />
        </Feld>
        <div className="sm:col-span-2">
          <Feld label="Kostenträger">
            <Input value={kostentraeger} onChange={(e) => setKostentraeger(e.target.value)} />
          </Feld>
        </div>
      </div>
      <Feld label="Hinweis">
        <Textarea value={hinweis} onChange={(e) => setHinweis(e.target.value)} rows={2} />
      </Feld>
      <Feld label="Medizinische Notiz">
        <Textarea
          value={medizinischeNotiz}
          onChange={(e) => setMedizinischeNotiz(e.target.value)}
          rows={2}
        />
      </Feld>
      <Feld label="Patientennotiz">
        <Textarea
          value={patientennotiz}
          onChange={(e) => setPatientennotiz(e.target.value)}
          rows={2}
        />
      </Feld>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={begleitperson} onCheckedChange={setBegleitperson} /> Begleitperson
        standardmäßig
      </label>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Abbrechen
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Speichern…" : "Speichern"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function Feld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
