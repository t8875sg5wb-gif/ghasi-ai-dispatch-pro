// ============================================================
// GHASI AI – Standorte & Umgebungssuche (Google Maps Platform)
// Kliniken, Ärzte, Apotheken, Tankstellen und Ladesäulen im
// Umkreis des Betriebshofs finden, Service-Gebiet visualisieren und
// Favoriten speichern. Alle Daten über den Google-Maps-Connector.
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Hospital,
  Stethoscope,
  Pill,
  Fuel,
  Zap,
  Star,
  Navigation,
  Loader2,
  Search,
  Layers,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PoiMap, type PoiMarker } from "@/components/maps/poi-map";
import { GOOGLE_MAP_STILE, type GoogleMapStil } from "@/lib/google-maps";
import {
  searchPlaces,
  type PlaceErgebnis,
  type PlaceKategorie,
} from "@/lib/google-maps.functions";

export const Route = createFileRoute("/standorte")({
  head: () => ({
    meta: [
      { title: "Standorte & Umgebung – GHASI AI" },
      {
        name: "description",
        content:
          "Kliniken, Ärzte, Apotheken, Tank- und Ladesäulen im Umkreis finden – mit Google Maps, Distanzen, Service-Gebiet und Favoriten.",
      },
    ],
  }),
  component: StandorteSeite,
});

// Betriebshof (Berlin-Mitte) als Standardzentrum.
const BASIS = { lat: 52.52, lng: 13.405 };

interface KategorieDef {
  id: PlaceKategorie;
  label: string;
  icon: typeof Hospital;
  farbe: string;
}

const KATEGORIEN: KategorieDef[] = [
  { id: "hospital", label: "Kliniken", icon: Hospital, farbe: "#dc2626" },
  { id: "doctor", label: "Ärzte", icon: Stethoscope, farbe: "#2563eb" },
  { id: "pharmacy", label: "Apotheken", icon: Pill, farbe: "#16a34a" },
  { id: "gas_station", label: "Tankstellen", icon: Fuel, farbe: "#ea580c" },
  { id: "electric_vehicle_charging_station", label: "Ladesäulen", icon: Zap, farbe: "#0891b2" },
];

interface Favorit extends PlaceErgebnis {
  kategorie: PlaceKategorie;
}

const FAV_KEY = "ghasi:standorte:favoriten";

function ladeFavoriten(): Favorit[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(FAV_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function StandorteSeite() {
  const suche = useServerFn(searchPlaces);
  const [kategorie, setKategorie] = useState<PlaceKategorie>("hospital");
  const [text, setText] = useState("");
  const [radiusKm, setRadiusKm] = useState(8);
  const [stil, setStil] = useState<GoogleMapStil>("roadmap");
  const [ergebnisse, setErgebnisse] = useState<PlaceErgebnis[]>([]);
  const [ladend, setLadend] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [favoriten, setFavoriten] = useState<Favorit[]>([]);
  const [zeigeFavoriten, setZeigeFavoriten] = useState(false);

  useEffect(() => setFavoriten(ladeFavoriten()), []);

  const aktuelleFarbe = useMemo(
    () => KATEGORIEN.find((k) => k.id === kategorie)?.farbe ?? "#dc2626",
    [kategorie],
  );

  async function starten(kat: PlaceKategorie, freitext?: string) {
    setKategorie(kat);
    setZeigeFavoriten(false);
    setLadend(true);
    setFehler(null);
    setSelected(null);
    try {
      const res = await suche({
        data: {
          kategorie: kat,
          text: freitext?.trim() || undefined,
          lat: BASIS.lat,
          lng: BASIS.lng,
          radius: radiusKm * 1000,
        },
      });
      setErgebnisse(res);
      if (res.length === 0) setFehler("Keine Treffer im gewählten Umkreis.");
    } catch (e) {
      console.error(e);
      setFehler("Suche momentan nicht verfügbar.");
      setErgebnisse([]);
    } finally {
      setLadend(false);
    }
  }

  function speichereFav(p: PlaceErgebnis) {
    setFavoriten((prev) => {
      const exists = prev.some((f) => f.id === p.id);
      const next = exists
        ? prev.filter((f) => f.id !== p.id)
        : [...prev, { ...p, kategorie }];
      if (typeof window !== "undefined")
        window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }

  const listeQuelle = zeigeFavoriten ? favoriten : ergebnisse;
  const marker: PoiMarker[] = listeQuelle
    .filter((p) => typeof p.lat === "number" && typeof p.lng === "number")
    .map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      name: p.name,
      farbe:
        zeigeFavoriten && "kategorie" in p
          ? KATEGORIEN.find((k) => k.id === (p as Favorit).kategorie)?.farbe
          : aktuelleFarbe,
    }));

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Standorte &amp; Umgebung</h1>
        <p className="text-sm text-muted-foreground">
          Kliniken, Ärzte, Apotheken, Tank- &amp; Ladesäulen im Umkreis – powered by Google Maps
          Platform.
        </p>
      </div>

      {/* Kategorien */}
      <div className="flex flex-wrap gap-2">
        {KATEGORIEN.map((k) => {
          const Icon = k.icon;
          const aktiv = !zeigeFavoriten && kategorie === k.id;
          return (
            <Button
              key={k.id}
              variant={aktiv ? "default" : "outline"}
              size="sm"
              onClick={() => void starten(k.id)}
              className="gap-1.5"
            >
              <Icon className="size-4" />
              {k.label}
            </Button>
          );
        })}
        <Button
          variant={zeigeFavoriten ? "default" : "outline"}
          size="sm"
          onClick={() => setZeigeFavoriten((v) => !v)}
          className="gap-1.5"
        >
          <Star className="size-4" />
          Favoriten ({favoriten.length})
        </Button>
      </div>

      {/* Freitext + Radius + Stil */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void starten(kategorie, text)}
            placeholder="Freitextsuche, z. B. „Charité Notaufnahme“"
          />
          <Button onClick={() => void starten(kategorie, text)} className="gap-1.5">
            <Search className="size-4" /> Suchen
          </Button>
        </div>
        <div className="flex min-w-[220px] items-center gap-3 rounded-xl border border-border/70 px-3">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            Umkreis {radiusKm} km
          </span>
          <Slider
            value={[radiusKm]}
            min={1}
            max={30}
            step={1}
            onValueChange={(v) => setRadiusKm(v[0])}
            className="w-32"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border/70 p-1">
          <Layers className="ml-1 size-4 text-muted-foreground" />
          {GOOGLE_MAP_STILE.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={stil === s.id ? "secondary" : "ghost"}
              onClick={() => setStil(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* Karte */}
        <Card className="overflow-hidden">
          <PoiMap
            center={BASIS}
            marker={marker}
            radiusMeter={zeigeFavoriten ? undefined : radiusKm * 1000}
            stil={stil}
            selectedId={selected}
            onSelect={setSelected}
            className="h-[420px] w-full lg:h-[560px]"
          />
        </Card>

        {/* Liste */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span>
                {zeigeFavoriten
                  ? "Gespeicherte Favoriten"
                  : KATEGORIEN.find((k) => k.id === kategorie)?.label}
              </span>
              {ladend && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            {fehler && !zeigeFavoriten && (
              <p className="px-4 py-6 text-sm text-muted-foreground">{fehler}</p>
            )}
            {zeigeFavoriten && favoriten.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Noch keine Favoriten gespeichert. Tippe bei einem Treffer auf den Stern.
              </p>
            )}
            {!ladend && !zeigeFavoriten && ergebnisse.length === 0 && !fehler && (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Wähle eine Kategorie oder starte eine Freitextsuche.
              </p>
            )}
            <ScrollArea className="h-[440px] lg:h-[500px]">
              <ul className="divide-y divide-border/60">
                {listeQuelle.map((p) => {
                  const fav = favoriten.some((f) => f.id === p.id);
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "cursor-pointer px-4 py-3 transition-colors hover:bg-accent/60",
                        selected === p.id && "bg-accent",
                      )}
                      onClick={() => setSelected(p.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.adresse}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {typeof p.distanzMeter === "number" && (
                              <Badge variant="secondary" className="gap-1 text-[11px]">
                                <Navigation className="size-3" />
                                {(p.distanzMeter / 1000).toFixed(1)} km
                              </Badge>
                            )}
                            {typeof p.bewertung === "number" && (
                              <Badge variant="outline" className="gap-1 text-[11px]">
                                <Star className="size-3" /> {p.bewertung.toFixed(1)}
                              </Badge>
                            )}
                            {p.geoeffnet != null && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[11px]",
                                  p.geoeffnet
                                    ? "border-success/40 text-success"
                                    : "border-destructive/40 text-destructive",
                                )}
                              >
                                {p.geoeffnet ? "geöffnet" : "geschlossen"}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              speichereFav(p);
                            }}
                            title={fav ? "Favorit entfernen" : "Als Favorit speichern"}
                          >
                            <Star
                              className={cn(
                                "size-4",
                                fav && "fill-amber-400 text-amber-400",
                              )}
                            />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            asChild
                            title="Route öffnen"
                          >
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Navigation className="size-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
