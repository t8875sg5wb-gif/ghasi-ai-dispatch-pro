import { useEffect, useState } from "react";

import {
  type Auftrag,
  type AuftragPrioritaet,
  type Transportart,
  FAHRER_OPTIONEN,
  FAHRZEUG_OPTIONEN,
  PRIORITAETEN,
  PRIORITAET_META,
  TRANSPORTARTEN,
} from "@/lib/auftraege";
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
