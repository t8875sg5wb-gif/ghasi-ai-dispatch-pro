// ============================================================
// GHASI AI – Google Places Adress-Autovervollständigung
// Nutzt die Places API (New) Browser-Surface (AutocompleteSuggestion)
// über den verbundenen Google-Maps-Connector. Liefert strukturierte
// Adressen inkl. Koordinaten zurück.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { type AdresseStruktur, leereAdresse } from "@/lib/address";
import { loadGoogleMaps } from "@/lib/google-maps";

export interface OrtKoordinate {
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  onSelect: (adresse: AdresseStruktur, coords: OrtKoordinate | null) => void;
  label?: string;
  placeholder?: string;
  id?: string;
  className?: string;
}

interface Vorschlag {
  text: string;
  place: google.maps.places.Place;
}

function mapComponents(
  components: google.maps.places.AddressComponent[] | undefined,
): AdresseStruktur {
  const adr = leereAdresse();
  if (!components) return adr;
  for (const c of components) {
    const t = c.types;
    if (t.includes("route")) adr.street = c.longText ?? adr.street;
    else if (t.includes("street_number")) adr.houseNumber = c.longText ?? adr.houseNumber;
    else if (t.includes("postal_code")) adr.postalCode = c.longText ?? adr.postalCode;
    else if (t.includes("locality") || t.includes("postal_town"))
      adr.city = c.longText ?? adr.city;
    else if (!adr.city && t.includes("administrative_area_level_1"))
      adr.city = c.longText ?? adr.city;
    else if (t.includes("country")) adr.country = c.longText ?? adr.country;
  }
  return adr;
}

export function AddressAutocomplete({
  onSelect,
  label,
  placeholder = "Adresse suchen …",
  id = "addr-autocomplete",
  className,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [vorschlaege, setVorschlaege] = useState<Vorschlag[]>([]);
  const [offen, setOffen] = useState(false);
  const [ladend, setLadend] = useState(false);
  const [fehler, setFehler] = useState(false);
  const tokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  const suche = useMemo(
    () => async (input: string) => {
      if (!input.trim() || input.trim().length < 3) {
        setVorschlaege([]);
        return;
      }
      setLadend(true);
      setFehler(false);
      try {
        await loadGoogleMaps();
        const { AutocompleteSuggestion, AutocompleteSessionToken } =
          (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
        if (!tokenRef.current) tokenRef.current = new AutocompleteSessionToken();
        const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: tokenRef.current,
          language: "de",
          region: "de",
        });
        const items: Vorschlag[] = suggestions
          .filter((s) => s.placePrediction)
          .slice(0, 6)
          .map((s) => ({
            text: s.placePrediction!.text.text,
            place: s.placePrediction!.toPlace(),
          }));
        setVorschlaege(items);
        setOffen(true);
      } catch (e) {
        console.error("Places-Autocomplete Fehler", e);
        setFehler(true);
        setVorschlaege([]);
      } finally {
        setLadend(false);
      }
    },
    [],
  );

  function onInput(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void suche(v), 280);
  }

  async function waehle(vorschlag: Vorschlag) {
    setOffen(false);
    setQuery(vorschlag.text);
    try {
      await vorschlag.place.fetchFields({
        fields: ["addressComponents", "location", "formattedAddress"],
      });
      const adr = mapComponents(vorschlag.place.addressComponents ?? undefined);
      const loc = vorschlag.place.location;
      const coords = loc ? { lat: loc.lat(), lng: loc.lng() } : null;
      onSelect(adr, coords);
    } catch (e) {
      console.error("Place-Details Fehler", e);
    } finally {
      tokenRef.current = null; // Session nach Auswahl beenden
    }
  }

  return (
    <div ref={boxRef} className={cn("relative space-y-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={query}
          onChange={(e) => onInput(e.target.value)}
          onFocus={() => vorschlaege.length > 0 && setOffen(true)}
          placeholder={placeholder}
          className="pl-9"
          autoComplete="off"
        />
        {ladend && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {fehler && (
        <p className="text-xs text-muted-foreground">
          Adresssuche momentan nicht verfügbar – bitte manuell eingeben.
        </p>
      )}
      {offen && vorschlaege.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {vorschlaege.map((v, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => void waehle(v)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>{v.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
