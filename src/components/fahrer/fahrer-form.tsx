import { useEffect, useState } from "react";

import {
  type Fahrer,
  type FahrerStatus,
  type Vertragsart,
  FAHRER_STATI,
  FAHRER_STATUS_META,
  VERTRAGSARTEN,
} from "@/lib/fahrer";
import { FAHRZEUG_OPTIONEN } from "@/lib/auftraege";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressFields } from "@/components/forms/address-fields";
import { parseAdresse, formatAdresse, type AdresseStruktur } from "@/lib/address";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FahrerFormValues = Omit<Fahrer, "id" | "nummer">;

interface FahrerFormProps {
  initial?: Fahrer;
  onSubmit: (values: FahrerFormValues) => void;
  onCancel: () => void;
  submitLabel: string;
}

const NONE = "__none__";

function emptyValues(): FahrerFormValues {
  return {
    name: "",
    foto: null,
    telefon: "",
    email: "",
    adresse: "",
    fuehrerschein: { gueltigBis: "", info: "Klasse B" },
    pSchein: { gueltigBis: "" },
    ersteHilfe: { gueltigBis: "" },
    vertragsart: "Vollzeit",
    arbeitszeiten: "Mo–Fr, 06:00–14:00",
    urlaubstage: 25,
    krankheitstage: 0,
    status: "verfuegbar",
    standort: "Betriebshof",
    gps: { lat: 52.52, lng: 13.405 },
    fahrzeug: null,
    schicht: "06:00 – 14:00",
    bewertung: 4.5,
    puenktlichkeit: 95,
    beschwerden: 0,
    lob: 0,
    ueberstunden: 0,
    kmHeute: 0,
    umsatzHeute: 0,
    gewinnHeute: 0,
  };
}

export function FahrerForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: FahrerFormProps) {
  const [values, setValues] = useState<FahrerFormValues>(emptyValues);
  const [adr, setAdr] = useState<AdresseStruktur>(() => parseAdresse(""));

  useEffect(() => {
    if (initial) {
      const { id: _id, nummer: _nummer, ...rest } = initial;
      setValues(rest);
      setAdr(parseAdresse(initial.adresse));
    } else {
      setValues(emptyValues());
      setAdr(parseAdresse(""));
    }
  }, [initial]);

  function set<K extends keyof FahrerFormValues>(key: K, value: FahrerFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }


  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) return;
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="z. B. M. Keller"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="telefon">Telefonnummer</Label>
          <Input
            id="telefon"
            value={values.telefon}
            onChange={(e) => set("telefon", e.target.value)}
            placeholder="+49 …"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="name@…"
          />
        </div>
      </div>

      <AddressFields
        idPrefix="fahrer-adresse"
        label="Adresse"
        value={adr}
        onChange={(next) => {
          setAdr(next);
          set("adresse", formatAdresse(next));
        }}
      />



      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="fs">Führerschein bis</Label>
          <Input
            id="fs"
            type="date"
            value={values.fuehrerschein.gueltigBis}
            onChange={(e) => set("fuehrerschein", { ...values.fuehrerschein, gueltigBis: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ps">P-Schein bis</Label>
          <Input
            id="ps"
            type="date"
            value={values.pSchein.gueltigBis}
            onChange={(e) => set("pSchein", { ...values.pSchein, gueltigBis: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eh">Erste-Hilfe bis</Label>
          <Input
            id="eh"
            type="date"
            value={values.ersteHilfe.gueltigBis}
            onChange={(e) => set("ersteHilfe", { ...values.ersteHilfe, gueltigBis: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Arbeitsvertrag</Label>
          <Select
            value={values.vertragsart}
            onValueChange={(v) => set("vertragsart", v as Vertragsart)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERTRAGSARTEN.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="azeit">Arbeitszeiten</Label>
          <Input
            id="azeit"
            value={values.arbeitszeiten}
            onChange={(e) => set("arbeitszeiten", e.target.value)}
            placeholder="Mo–Fr, 06:00–14:00"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Live-Status</Label>
          <Select
            value={values.status}
            onValueChange={(v) => set("status", v as FahrerStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FAHRER_STATI.map((s) => (
                <SelectItem key={s} value={s}>
                  {FAHRER_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Verfügbares Fahrzeug</Label>
          <Select
            value={values.fahrzeug ?? NONE}
            onValueChange={(v) => set("fahrzeug", v === NONE ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kein Fahrzeug" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Kein Fahrzeug</SelectItem>
              {FAHRZEUG_OPTIONEN.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="schicht">Schichtplan</Label>
          <Input
            id="schicht"
            value={values.schicht}
            onChange={(e) => set("schicht", e.target.value)}
            placeholder="06:00 – 14:00"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="urlaub">Urlaubstage</Label>
          <Input
            id="urlaub"
            type="number"
            min={0}
            value={values.urlaubstage}
            onChange={(e) => set("urlaubstage", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="krank">Krankheitstage</Label>
          <Input
            id="krank"
            type="number"
            min={0}
            value={values.krankheitstage}
            onChange={(e) => set("krankheitstage", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="bew">Bewertung (0–5)</Label>
          <Input
            id="bew"
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={values.bewertung}
            onChange={(e) => set("bewertung", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="puenkt">Pünktlichkeit (%)</Label>
          <Input
            id="puenkt"
            type="number"
            min={0}
            max={100}
            value={values.puenktlichkeit}
            onChange={(e) => set("puenktlichkeit", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ueber">Überstunden (h)</Label>
          <Input
            id="ueber"
            type="number"
            min={0}
            value={values.ueberstunden}
            onChange={(e) => set("ueberstunden", Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lob">Lob</Label>
          <Input
            id="lob"
            type="number"
            min={0}
            value={values.lob}
            onChange={(e) => set("lob", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="besch">Beschwerden</Label>
          <Input
            id="besch"
            type="number"
            min={0}
            value={values.beschwerden}
            onChange={(e) => set("beschwerden", Number(e.target.value))}
          />
        </div>
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
