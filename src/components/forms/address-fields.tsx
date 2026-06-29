// Wiederverwendbare strukturierte Adress-Eingabe (Straße, Hausnummer, PLZ,
// Stadt, Land, Zusatzinfo). Nutzbar in allen Formularen des Systems.
import { type AdresseStruktur } from "@/lib/address";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AddressFieldsProps {
  value: AdresseStruktur;
  onChange: (value: AdresseStruktur) => void;
  /** Präfix für Feld-IDs (bei mehreren Adressen pro Formular) */
  idPrefix: string;
  /** Überschrift, z. B. "Abholort" */
  label?: string;
  required?: boolean;
}

export function AddressFields({ value, onChange, idPrefix, label, required }: AddressFieldsProps) {
  function set<K extends keyof AdresseStruktur>(key: K, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 p-3">
      {label && (
        <p className="text-sm font-semibold">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-street`}>Straße</Label>
          <Input
            id={`${idPrefix}-street`}
            value={value.street}
            onChange={(e) => set("street", e.target.value)}
            placeholder="z. B. Lindenstraße"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-house`}>Hausnummer</Label>
          <Input
            id={`${idPrefix}-house`}
            value={value.houseNumber}
            onChange={(e) => set("houseNumber", e.target.value)}
            placeholder="12a"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-plz`}>PLZ</Label>
          <Input
            id={`${idPrefix}-plz`}
            value={value.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            placeholder="10969"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-city`}>Stadt</Label>
          <Input
            id={`${idPrefix}-city`}
            value={value.city}
            onChange={(e) => set("city", e.target.value)}
            placeholder="Berlin"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-country`}>Land</Label>
        <Input
          id={`${idPrefix}-country`}
          value={value.country}
          onChange={(e) => set("country", e.target.value)}
          placeholder="Deutschland"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-info`}>Zusatzinfo</Label>
        <Textarea
          id={`${idPrefix}-info`}
          value={value.additionalInfo}
          onChange={(e) => set("additionalInfo", e.target.value)}
          placeholder="z. B. 3. OG ohne Aufzug, Klingel Schmidt"
          rows={2}
        />
      </div>
    </div>
  );
}
