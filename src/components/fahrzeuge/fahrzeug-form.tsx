import { useEffect, useState } from "react";

import {
  type Fahrzeug,
  type FahrzeugStatus,
  type Fahrzeugtyp,
  type Kraftstoffart,
  type Reifenstatus,
  FAHRZEUG_STATI,
  FAHRZEUG_STATUS_META,
  FAHRZEUGTYPEN,
  KRAFTSTOFFARTEN,
  REIFENSTATI,
  REIFEN_META,
} from "@/lib/fahrzeuge";
import { FAHRER_OPTIONEN } from "@/lib/auftraege";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FahrzeugFormValues = Omit<Fahrzeug, "id" | "nummer">;

interface FahrzeugFormProps {
  initial?: Fahrzeug;
  onSubmit: (values: FahrzeugFormValues) => void;
  onCancel: () => void;
  submitLabel: string;
}

const NONE = "__none__";

function emptyValues(): FahrzeugFormValues {
  return {
    kennzeichen: "",
    marke: "",
    modell: "",
    baujahr: new Date().getFullYear(),
    typ: "KTW",
    rollstuhlGeeignet: true,
    liegendGeeignet: false,
    sitzplaetze: 2,
    status: "frei",
    fahrer: null,
    standort: "Betriebshof",
    gps: { lat: 52.52, lng: 13.405 },
    kilometerstand: 0,
    tankstand: 100,
    kraftstoff: "Diesel",
    verbrauch: 9,
    reichweite: 600,
    kostenProKm: 0.6,
    tagesumsatz: 0,
    tagesgewinn: 0,
    monatsumsatz: 0,
    monatsgewinn: 0,
    tuevBis: "",
    oelwechselBei: 0,
    naechsteWartung: "",
    reifenstatus: "gut",
    reparaturen: [],
    versicherung: "",
    versicherungBis: "",
    leasingrate: 0,
    leasingEnde: "",
    dokumente: [],
    fotos: [],
    notizen: "",
  };
}

export function FahrzeugForm({ initial, onSubmit, onCancel, submitLabel }: FahrzeugFormProps) {
  const [values, setValues] = useState<FahrzeugFormValues>(emptyValues);

  useEffect(() => {
    if (initial) {
      const { id: _id, nummer: _nummer, ...rest } = initial;
      setValues(rest);
    } else {
      setValues(emptyValues());
    }
  }, [initial]);

  function set<K extends keyof FahrzeugFormValues>(key: K, value: FahrzeugFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.kennzeichen.trim()) return;
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Identification */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="kennzeichen">Kennzeichen</Label>
          <Input
            id="kennzeichen"
            value={values.kennzeichen}
            onChange={(e) => set("kennzeichen", e.target.value)}
            placeholder="z. B. B-KT 142"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Fahrzeugtyp</Label>
          <Select value={values.typ} onValueChange={(v) => set("typ", v as Fahrzeugtyp)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FAHRZEUGTYPEN.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="marke">Marke</Label>
          <Input
            id="marke"
            value={values.marke}
            onChange={(e) => set("marke", e.target.value)}
            placeholder="Mercedes-Benz"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="modell">Modell</Label>
          <Input
            id="modell"
            value={values.modell}
            onChange={(e) => set("modell", e.target.value)}
            placeholder="Sprinter 314"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="baujahr">Baujahr</Label>
          <Input
            id="baujahr"
            type="number"
            min={1990}
            max={new Date().getFullYear() + 1}
            value={values.baujahr}
            onChange={(e) => set("baujahr", Number(e.target.value))}
          />
        </div>
      </div>

      {/* Suitability */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5">
          <Label htmlFor="rolli" className="cursor-pointer">
            Rollstuhl
          </Label>
          <Switch
            id="rolli"
            checked={values.rollstuhlGeeignet}
            onCheckedChange={(v) => set("rollstuhlGeeignet", v)}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2.5">
          <Label htmlFor="liegend" className="cursor-pointer">
            Liegend
          </Label>
          <Switch
            id="liegend"
            checked={values.liegendGeeignet}
            onCheckedChange={(v) => set("liegendGeeignet", v)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sitze">Sitzplätze</Label>
          <Input
            id="sitze"
            type="number"
            min={0}
            value={values.sitzplaetze}
            onChange={(e) => set("sitzplaetze", Number(e.target.value))}
          />
        </div>
      </div>

      {/* Status & driver */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={values.status} onValueChange={(v) => set("status", v as FahrzeugStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FAHRZEUG_STATI.map((s) => (
                <SelectItem key={s} value={s}>
                  {FAHRZEUG_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Aktueller Fahrer</Label>
          <Select
            value={values.fahrer ?? NONE}
            onValueChange={(v) => set("fahrer", v === NONE ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kein Fahrer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Kein Fahrer</SelectItem>
              {FAHRER_OPTIONEN.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="standort">Standort (Live-GPS)</Label>
        <Input
          id="standort"
          value={values.standort}
          onChange={(e) => set("standort", e.target.value)}
          placeholder="Betriebshof / Straße"
        />
      </div>

      {/* Mileage & fuel */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="km">Kilometerstand</Label>
          <Input
            id="km"
            type="number"
            min={0}
            value={values.kilometerstand}
            onChange={(e) => set("kilometerstand", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tank">Tankstand (%)</Label>
          <Input
            id="tank"
            type="number"
            min={0}
            max={100}
            value={values.tankstand}
            onChange={(e) => set("tankstand", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Kraftstoffart</Label>
          <Select
            value={values.kraftstoff}
            onValueChange={(v) => set("kraftstoff", v as Kraftstoffart)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KRAFTSTOFFARTEN.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="verbrauch">Ø Verbrauch</Label>
          <Input
            id="verbrauch"
            type="number"
            min={0}
            step={0.1}
            value={values.verbrauch}
            onChange={(e) => set("verbrauch", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reichweite">Reichweite (km)</Label>
          <Input
            id="reichweite"
            type="number"
            min={0}
            value={values.reichweite}
            onChange={(e) => set("reichweite", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kpk">Kosten / km (€)</Label>
          <Input
            id="kpk"
            type="number"
            min={0}
            step={0.01}
            value={values.kostenProKm}
            onChange={(e) => set("kostenProKm", Number(e.target.value))}
          />
        </div>
      </div>

      {/* Revenue & profit */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tu">Tagesumsatz (€)</Label>
          <Input
            id="tu"
            type="number"
            min={0}
            value={values.tagesumsatz}
            onChange={(e) => set("tagesumsatz", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tg">Tagesgewinn (€)</Label>
          <Input
            id="tg"
            type="number"
            value={values.tagesgewinn}
            onChange={(e) => set("tagesgewinn", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mu">Monatsumsatz (€)</Label>
          <Input
            id="mu"
            type="number"
            min={0}
            value={values.monatsumsatz}
            onChange={(e) => set("monatsumsatz", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mg">Monatsgewinn (€)</Label>
          <Input
            id="mg"
            type="number"
            value={values.monatsgewinn}
            onChange={(e) => set("monatsgewinn", Number(e.target.value))}
          />
        </div>
      </div>

      {/* Maintenance */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="tuev">TÜV gültig bis</Label>
          <Input
            id="tuev"
            type="date"
            value={values.tuevBis}
            onChange={(e) => set("tuevBis", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="oel">Ölwechsel bei (km)</Label>
          <Input
            id="oel"
            type="number"
            min={0}
            value={values.oelwechselBei}
            onChange={(e) => set("oelwechselBei", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nw">Nächste Wartung</Label>
          <Input
            id="nw"
            type="date"
            value={values.naechsteWartung}
            onChange={(e) => set("naechsteWartung", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Reifenstatus</Label>
          <Select
            value={values.reifenstatus}
            onValueChange={(v) => set("reifenstatus", v as Reifenstatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REIFENSTATI.map((r) => (
                <SelectItem key={r} value={r}>
                  {REIFEN_META[r].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Insurance & leasing */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vers">Versicherung</Label>
          <Input
            id="vers"
            value={values.versicherung}
            onChange={(e) => set("versicherung", e.target.value)}
            placeholder="z. B. HUK-Coburg"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="versbis">Versicherung bis</Label>
          <Input
            id="versbis"
            type="date"
            value={values.versicherungBis}
            onChange={(e) => set("versicherungBis", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leasing">Leasingrate (€/Monat)</Label>
          <Input
            id="leasing"
            type="number"
            min={0}
            value={values.leasingrate}
            onChange={(e) => set("leasingrate", Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leasingende">Leasingende</Label>
          <Input
            id="leasingende"
            type="date"
            value={values.leasingEnde}
            onChange={(e) => set("leasingEnde", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notizen">Notizen</Label>
        <Textarea
          id="notizen"
          value={values.notizen}
          onChange={(e) => set("notizen", e.target.value)}
          placeholder="Interne Hinweise zum Fahrzeug…"
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
