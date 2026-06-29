import { useEffect, useState } from "react";

import {
  type Auftrag,
  type AuftragPrioritaet,
  type Mobilitaet,
  type Transportart,
  type VerordnungStatus,
  FAHRER_OPTIONEN,
  FAHRZEUG_OPTIONEN,
  MOBILITAET_META,
  MOBILITAET_OPTIONEN,
  PRIORITAETEN,
  PRIORITAET_META,
  TRANSPORTARTEN,
  VERORDNUNG_META,
  VERORDNUNG_OPTIONEN,
} from "@/lib/auftraege";
import {
  type AdresseStruktur,
  parseAdresse,
  formatAdresse,
  leereAdresse,
  adresseGefuellt,
} from "@/lib/address";
import { AddressFields } from "@/components/forms/address-fields";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AuftragFormValues = Omit<Auftrag, "id" | "nummer" | "status">;

interface AuftragFormProps {
  initial?: Auftrag;
  onSubmit: (values: AuftragFormValues) => void;
  onCancel: () => void;
  submitLabel: string;
}

const NONE = "__none__";

function emptyValues(): AuftragFormValues {
  return {
    patient: "",
    transportart: "Sitzendtransport",
    prioritaet: "normal",
    abholort: "",
    zielort: "",
    termin: new Date().toISOString().slice(0, 16),
    fahrer: null,
    fahrzeug: null,
    kostentraeger: "",
    notiz: "",
    verordnung: "nicht_erhalten",
    verordnungDokumentId: null,
    mobilitaet: "gehfaehig",
    begleitperson: false,
    abholanforderung: "",
    zielanforderung: "",
    patientennotiz: "",
    medizinischeNotiz: "",
  };
}

export function AuftragForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: AuftragFormProps) {
  const [values, setValues] = useState<AuftragFormValues>(emptyValues);

  useEffect(() => {
    if (initial) {
      const { id: _id, nummer: _nummer, status: _status, ...rest } = initial;
      setValues({ ...rest, termin: rest.termin.slice(0, 16) });
    } else {
      setValues(emptyValues());
    }
  }, [initial]);

  function set<K extends keyof AuftragFormValues>(
    key: K,
    value: AuftragFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.patient.trim() || !values.abholort.trim() || !values.zielort.trim()) {
      return;
    }
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="patient">Patient</Label>
        <Input
          id="patient"
          value={values.patient}
          onChange={(e) => set("patient", e.target.value)}
          placeholder="Name des Patienten"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Transportart</Label>
          <Select
            value={values.transportart}
            onValueChange={(v) => set("transportart", v as Transportart)}
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
          <Label>Priorität</Label>
          <Select
            value={values.prioritaet}
            onValueChange={(v) => set("prioritaet", v as AuftragPrioritaet)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITAETEN.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITAET_META[p].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="abholort">Abholort</Label>
          <Input
            id="abholort"
            value={values.abholort}
            onChange={(e) => set("abholort", e.target.value)}
            placeholder="Startadresse"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zielort">Zielort</Label>
          <Input
            id="zielort"
            value={values.zielort}
            onChange={(e) => set("zielort", e.target.value)}
            placeholder="Zieladresse"
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="termin">Termin</Label>
          <Input
            id="termin"
            type="datetime-local"
            value={values.termin}
            onChange={(e) => set("termin", e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kostentraeger">Kostenträger</Label>
          <Input
            id="kostentraeger"
            value={values.kostentraeger}
            onChange={(e) => set("kostentraeger", e.target.value)}
            placeholder="z. B. AOK Nordost"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Fahrer</Label>
          <Select
            value={values.fahrer ?? NONE}
            onValueChange={(v) => set("fahrer", v === NONE ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Nicht zugewiesen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nicht zugewiesen</SelectItem>
              {FAHRER_OPTIONEN.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fahrzeug</Label>
          <Select
            value={values.fahrzeug ?? NONE}
            onValueChange={(v) => set("fahrzeug", v === NONE ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Nicht zugewiesen" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Nicht zugewiesen</SelectItem>
              {FAHRZEUG_OPTIONEN.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Medizinische Transportdetails */}
      <div className="rounded-xl border border-border/70 p-4 space-y-4">
        <p className="text-sm font-semibold">Medizinische Transportdetails</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Verordnung</Label>
            <Select
              value={values.verordnung ?? "nicht_erhalten"}
              onValueChange={(v) => set("verordnung", v as VerordnungStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERORDNUNG_OPTIONEN.map((v) => (
                  <SelectItem key={v} value={v}>
                    {VERORDNUNG_META[v].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Mobilität</Label>
            <Select
              value={values.mobilitaet ?? "gehfaehig"}
              onValueChange={(v) => set("mobilitaet", v as Mobilitaet)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOBILITAET_OPTIONEN.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MOBILITAET_META[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
          <div>
            <Label htmlFor="begleitperson">Begleitperson</Label>
            <p className="text-xs text-muted-foreground">Begleitet eine Person den Patienten?</p>
          </div>
          <Switch
            id="begleitperson"
            checked={values.begleitperson ?? false}
            onCheckedChange={(c) => set("begleitperson", c)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="abholanforderung">Anforderungen Abholort</Label>
            <Textarea
              id="abholanforderung"
              value={values.abholanforderung ?? ""}
              onChange={(e) => set("abholanforderung", e.target.value)}
              placeholder="z. B. 3. OG ohne Aufzug, Tragestuhl nötig"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zielanforderung">Anforderungen Zielort</Label>
            <Textarea
              id="zielanforderung"
              value={values.zielanforderung ?? ""}
              onChange={(e) => set("zielanforderung", e.target.value)}
              placeholder="z. B. Station 4, Anmeldung vorab"
              rows={2}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="patientennotiz">Patientennotiz</Label>
            <Textarea
              id="patientennotiz"
              value={values.patientennotiz ?? ""}
              onChange={(e) => set("patientennotiz", e.target.value)}
              placeholder="Hinweise zum Patienten"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="medizinischeNotiz">Medizinische Notiz</Label>
            <Textarea
              id="medizinischeNotiz"
              value={values.medizinischeNotiz ?? ""}
              onChange={(e) => set("medizinischeNotiz", e.target.value)}
              placeholder="z. B. Sauerstoff, Infektionsschutz"
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notiz">Notiz</Label>
        <Textarea
          id="notiz"
          value={values.notiz}
          onChange={(e) => set("notiz", e.target.value)}
          placeholder="Zusätzliche Hinweise zum Transport"
          rows={3}
        />
      </div>


      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
