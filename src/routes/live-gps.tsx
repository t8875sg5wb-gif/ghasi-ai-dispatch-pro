import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  MapPin,
  Navigation,
  Search,
  Gauge,
  Fuel,
  Clock,
  AlertTriangle,
  Layers,
  Route as RouteIcon,
  ShieldCheck,
  User,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FleetMap } from "@/components/gps/fleet-map";
import {
  type FleetVehicle,
  type LatLng,
  ALERT_SCHWERE_META,
  ANBIETER_BEREIT,
  FLEET_FARBEN,
  KARTEN_ANBIETER,
  buildFleet,
  computeFleetAlerts,
} from "@/lib/fleet-live";
import { LIVE_PIPELINE, LIVE_STATUS_META } from "@/lib/dispatch";
import { MOBILITAET_META, VERORDNUNG_META, effektiveVerordnung } from "@/lib/auftraege";

export const Route = createFileRoute("/live-gps")({
  head: () => ({
    meta: [
      { title: "Live-GPS – GHASI AI" },
      {
        name: "description",
        content:
          "Echtzeit-Flottenkarte mit OpenStreetMap: Live-Fahrzeuge, Routen, Transport-Status und automatische Alerts.",
      },
    ],
  }),
  component: LiveGps,
});

/** Bewegt fahrende Fahrzeuge ein kleines Stück Richtung nächstes Routenziel. */
function naechsterPunkt(v: FleetVehicle): LatLng | null {
  if (v.farbe !== "fahrt" && v.farbe !== "notfall") return null;
  const ziel = v.routeRest[1] ?? v.routeRest[0] ?? v.assignment?.pickup ?? null;
  if (!ziel) return null;
  const dlat = ziel.lat - v.gps.lat;
  const dlng = ziel.lng - v.gps.lng;
  const dist = Math.hypot(dlat, dlng);
  if (dist < 0.0008) return null;
  const step = 0.12;
  return {
    lat: Number((v.gps.lat + dlat * step).toFixed(5)),
    lng: Number((v.gps.lng + dlng * step).toFixed(5)),
  };
}

function LiveGps() {
  const [fleet, setFleet] = useState<FleetVehicle[]>(() => buildFleet());
  const [selected, setSelected] = useState<string | null>(null);
  const [suche, setSuche] = useState("");
  const [anbieterId, setAnbieterId] = useState(KARTEN_ANBIETER[0].id);

  // Live-Bewegung: fahrende Fahrzeuge alle 3s ein Stück weiterbewegen.
  useEffect(() => {
    const interval = setInterval(() => {
      setFleet((prev) =>
        prev.map((v) => {
          const next = naechsterPunkt(v);
          return next ? { ...v, gps: next } : v;
        }),
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const anbieter = useMemo(
    () => KARTEN_ANBIETER.find((a) => a.id === anbieterId) ?? KARTEN_ANBIETER[0],
    [anbieterId],
  );

  const alerts = useMemo(() => computeFleetAlerts(fleet), [fleet]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return fleet;
    return fleet.filter(
      (v) =>
        v.kennzeichen.toLowerCase().includes(q) ||
        (v.fahrer ?? "").toLowerCase().includes(q) ||
        v.standort.toLowerCase().includes(q) ||
        (v.assignment?.transport.patient.toLowerCase().includes(q) ?? false),
    );
  }, [fleet, suche]);

  const ausgewaehlt = fleet.find((v) => v.id === selected) ?? null;

  const zaehler = useMemo(() => {
    const z: Record<string, number> = { frei: 0, fahrt: 0, wartet: 0, notfall: 0, offline: 0 };
    for (const v of fleet) z[v.farbe] += 1;
    return z;
  }, [fleet]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-primary flex h-12 w-12 items-center justify-center rounded-2xl shadow-glow">
            <MapPin className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Live-GPS &amp; Transport-Execution</h1>
            <p className="text-sm text-muted-foreground">
              Echtzeit-Flottenkarte (OpenStreetMap) mit Routen, Status &amp; automatischen Alerts.
            </p>
          </div>
        </div>
        {/* Karten-Anbieter */}
        <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card p-1">
          <Layers className="ml-1 h-4 w-4 text-muted-foreground" />
          {KARTEN_ANBIETER.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setAnbieterId(a.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                a.id === anbieterId
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status-Legende */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(FLEET_FARBEN) as Array<keyof typeof FLEET_FARBEN>).map((k) => (
          <div
            key={k}
            className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-1.5 text-sm"
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: FLEET_FARBEN[k].hex }}
            />
            <span className="font-medium">{FLEET_FARBEN[k].label}</span>
            <span className="text-muted-foreground">{zaehler[k]}</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Map */}
        <Card className="overflow-hidden border-border/70 lg:col-span-2">
          <CardContent className="p-0">
            <div className="h-[68vh] min-h-[420px] w-full">
              <FleetMap
                vehicles={fleet}
                selectedId={selected}
                anbieter={anbieter}
                onSelect={(id) => setSelected((cur) => (cur === id ? cur : id))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Seitenleiste */}
        <div className="space-y-4">
          {/* Suche + Liste */}
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Navigation className="h-4 w-4 text-primary" /> Fahrzeuge live
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  placeholder="Kennzeichen, Fahrer, Patient…"
                  className="pl-9"
                />
              </div>
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {gefiltert.map((v) => {
                  const farbe = FLEET_FARBEN[v.farbe];
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelected(selected === v.id ? null : v.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors",
                        selected === v.id
                          ? "border-primary/50 bg-primary/5"
                          : "border-border/70 hover:bg-muted/50",
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: farbe.hex }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{v.kennzeichen}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {v.fahrer ?? "kein Fahrer"} · {v.standort}
                        </p>
                      </div>
                      {v.alerts.length > 0 && (
                        <Badge className="shrink-0 gap-1 border-destructive/30 bg-destructive/10 text-[10px] text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {v.alerts.length}
                        </Badge>
                      )}
                    </button>
                  );
                })}
                {gefiltert.length === 0 && (
                  <p className="px-1 py-4 text-center text-sm text-muted-foreground">
                    Keine Fahrzeuge gefunden.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Detail des gewählten Fahrzeugs */}
          {ausgewaehlt && <VehicleDetail v={ausgewaehlt} />}

          {/* Alerts */}
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-warning" /> Automatische Alerts
                <Badge variant="secondary" className="ml-auto">
                  {alerts.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alerts.length === 0 && (
                <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-sm text-success">
                  <ShieldCheck className="h-4 w-4" /> Keine offenen Alerts.
                </p>
              )}
              {alerts.slice(0, 8).map((a, i) => {
                const meta = ALERT_SCHWERE_META[a.schwere];
                return (
                  <div
                    key={`${a.typ}-${a.kennzeichen}-${i}`}
                    className="flex items-start gap-2 rounded-xl border border-border/70 p-2.5"
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{a.titel}</p>
                        <Badge className={cn("shrink-0 text-[10px]", meta.badge)}>{meta.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{a.details}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Integrationen / Anbieter-Architektur */}
          <Card className="border-dashed border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <RouteIcon className="h-4 w-4 text-primary" /> Karten- &amp; GPS-Integrationen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                Aktiv: OpenStreetMap, CARTO (Dunkel), Esri Satellit. Architektur vorbereitet für:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ANBIETER_BEREIT.map((a) => (
                  <Badge key={a.id} variant="secondary" className="text-[10px]">
                    {a.label}
                  </Badge>
                ))}
                {["Apple Maps", "Waze", "Twilio", "WhatsApp Business", "Firebase", "GPS-Tracker"].map(
                  (x) => (
                    <Badge key={x} variant="secondary" className="text-[10px]">
                      {x}
                    </Badge>
                  ),
                )}
              </div>
              <p>
                Sobald ein API-Key hinterlegt ist, wird der jeweilige Layer/Dienst ohne weitere
                Umbauten aktiviert.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kennzahl({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 p-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function VehicleDetail({ v }: { v: FleetVehicle }) {
  const farbe = FLEET_FARBEN[v.farbe];
  const a = v.assignment;
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: farbe.hex }} />
          {v.kennzeichen}
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {v.typ}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{v.fahrer ?? "Kein Fahrer"}</span>
          <Badge className={cn("ml-auto text-[10px]", farbe.badge)}>{farbe.label}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Kennzahl icon={Gauge} label="Tempo" value={`${v.geschwindigkeit} km/h`} />
          <Kennzahl icon={Fuel} label="Tank" value={`${v.tankstand}%`} />
          <Kennzahl icon={MapPin} label="Standort" value={v.standort} />
          <Kennzahl icon={Clock} label="Update" value={v.letzteAktualisierung} />
        </div>

        {a ? (
          <>
            <div className="rounded-xl border border-border/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Aktueller Transport
              </p>
              <p className="mt-1 text-sm font-semibold">
                {a.transport.nummer} · {a.transport.patient}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {a.transport.abholort} → {a.transport.zielort}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge className={cn("text-[10px]", LIVE_STATUS_META[a.liveStatus].badge)}>
                  {LIVE_STATUS_META[a.liveStatus].label}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {MOBILITAET_META[a.mobilitaet].label}
                </Badge>
                <Badge
                  className={cn(
                    "text-[10px]",
                    a.verordnungFehlt
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-success/30 bg-success/10 text-success",
                  )}
                >
                  Verordnung: {a.verordnungFehlt ? "fehlt" : VERORDNUNG_META[effektiveVerordnung(a.transport)].kurz}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  Begleitung: {a.begleitperson ? "Ja" : "Nein"}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  ETA {a.eta}
                </Badge>
                {!a.fahrzeugPasst && (
                  <Badge className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive">
                    Fahrzeug ungeeignet
                  </Badge>
                )}
              </div>
            </div>

            {/* Lifecycle-Timeline */}
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Transport-Lebenszyklus
              </p>
              <div className="space-y-1.5">
                {LIVE_PIPELINE.map((status) => {
                  const meta = LIVE_STATUS_META[status];
                  const erreicht = meta.stufe <= LIVE_STATUS_META[a.liveStatus].stufe;
                  const aktuell = status === a.liveStatus;
                  return (
                    <div key={status} className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]",
                          erreicht
                            ? "border-success bg-success text-success-foreground"
                            : "border-border bg-muted text-muted-foreground",
                          aktuell && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                        )}
                      >
                        {erreicht ? "✓" : ""}
                      </span>
                      <span
                        className={cn(
                          "text-sm",
                          aktuell ? "font-semibold text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-border/70 p-3 text-sm text-muted-foreground">
            Kein aktiver Transport zugewiesen.
          </p>
        )}

        {v.alerts.length > 0 && (
          <div className="space-y-1.5">
            {v.alerts.map((al, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="text-xs">
                  <p className="font-semibold text-destructive">{al.titel}</p>
                  <p className="text-muted-foreground">{al.details}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
