import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin, Navigation, Truck, Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { INITIAL_FAHRZEUGE, FAHRZEUG_STATUS_META } from "@/lib/fahrzeuge";

export const Route = createFileRoute("/live-gps")({
  head: () => ({
    meta: [
      { title: "Live-GPS – GHASI AI" },
      {
        name: "description",
        content: "Standort aller Fahrzeuge und Fahrer in Echtzeit auf der Flottenkarte.",
      },
    ],
  }),
  component: LiveGps,
});

// Bounding box around Berlin for normalising gps -> percentage.
const BOUNDS = { latMin: 52.46, latMax: 52.55, lngMin: 13.29, lngMax: 13.47 };

function pos(lat: number, lng: number) {
  const x = ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * 100;
  const y = (1 - (lat - BOUNDS.latMin) / (BOUNDS.latMax - BOUNDS.latMin)) * 100;
  return { x: Math.max(4, Math.min(96, x)), y: Math.max(6, Math.min(94, y)) };
}

function LiveGps() {
  const [selected, setSelected] = useState<string | null>(null);
  const fahrzeuge = useMemo(() => INITIAL_FAHRZEUGE, []);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-gradient-primary flex h-12 w-12 items-center justify-center rounded-2xl shadow-glow">
          <MapPin className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live-GPS</h1>
          <p className="text-sm text-muted-foreground">
            Flotten-Karte mit Echtzeit-Standorten – bereit für externe GPS-Anbieter.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Map */}
        <Card className="overflow-hidden border-border/70 lg:col-span-2">
          <CardContent className="p-0">
            <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-muted/40 to-muted/10">
              {/* grid lines */}
              <svg className="absolute inset-0 h-full w-full" aria-hidden>
                <defs>
                  <pattern id="grid" width="8%" height="8%" patternUnits="userSpaceOnUse">
                    <path
                      d="M 100 0 L 0 0 0 100"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="0.5"
                      className="text-border/40"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {fahrzeuge.map((v) => {
                const p = pos(v.gps.lat, v.gps.lng);
                const meta = FAHRZEUG_STATUS_META[v.status];
                const isSel = selected === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelected(isSel ? null : v.id)}
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                  >
                    <span className="relative flex items-center justify-center">
                      {v.status === "unterwegs" && (
                        <span
                          className={cn(
                            "absolute h-9 w-9 animate-ping rounded-full opacity-40",
                            meta.dot,
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-background shadow-card transition-transform",
                          meta.dot,
                          isSel && "scale-125",
                        )}
                      >
                        <Truck className="h-4 w-4 text-background" />
                      </span>
                    </span>
                    {isSel && (
                      <span className="absolute left-1/2 top-9 z-10 w-40 -translate-x-1/2 rounded-lg border border-border/70 bg-popover p-2 text-left text-xs shadow-card">
                        <span className="block font-semibold">{v.kennzeichen}</span>
                        <span className="block text-muted-foreground">{v.standort}</span>
                        <span className="block text-muted-foreground">
                          {v.fahrer ?? "kein Fahrer"}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* List */}
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Navigation className="h-4 w-4 text-primary" /> Fahrzeuge live
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {fahrzeuge.map((v) => {
              const meta = FAHRZEUG_STATUS_META[v.status];
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
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", meta.dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{v.kennzeichen}</p>
                    <p className="truncate text-xs text-muted-foreground">{v.standort}</p>
                  </div>
                  <Badge className={cn("shrink-0 text-[10px]", meta.badge)}>{meta.label}</Badge>
                </button>
              );
            })}
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
              <Search className="h-4 w-4 shrink-0" />
              Externe GPS-Anbieter (z. B. Telematik) können später angebunden werden – die
              Karte ist dafür vorbereitet.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
