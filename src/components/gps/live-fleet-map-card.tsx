// Wiederverwendbare Live-Flottenkarte (Google Maps) für Dashboard und
// Dispatch. Kapselt Fleet-Aufbau, sanfte Live-Bewegung, Auswahl und
// Stil-Umschalter. Client-only (Karte lädt erst im Browser).
import { useMemo, useState } from "react";
import { Layers, MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GoogleFleetMap } from "@/components/gps/google-fleet-map";
import { GOOGLE_MAP_STILE, type GoogleMapStil } from "@/lib/google-maps";
import { FLEET_FARBEN, buildFleet } from "@/lib/fleet-live";
import { useVehicles } from "@/lib/vehicles-store";
import { useDrivers } from "@/lib/drivers-store";
import { useOrders } from "@/lib/orders-store";

export function LiveFleetMapCard({
  height = "h-[320px]",
  className,
}: {
  height?: string;
  className?: string;
}) {
  const { data: fahrzeuge = [] } = useVehicles();
  const { data: fahrer = [] } = useDrivers();
  const { data: auftraege = [] } = useOrders();
  const fleet = useMemo(
    () => buildFleet({ fahrzeuge, fahrer, auftraege }),
    [fahrzeuge, fahrer, auftraege],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [stil, setStil] = useState<GoogleMapStil>("roadmap");

  const zaehler = useMemo(() => {
    const z: Record<string, number> = { frei: 0, fahrt: 0, wartet: 0, offline: 0 };
    for (const v of fleet) z[v.farbe] += 1;
    return z;
  }, [fleet]);

  return (
    <Card className={cn("overflow-hidden border-border/70 shadow-sm", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <MapPin className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Live-Flotte (Google Maps)</p>
            <p className="text-xs text-muted-foreground">
              {zaehler.fahrt} unterwegs · {zaehler.frei} frei · {zaehler.wartet} warten
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card p-1">
          <Layers className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
          {GOOGLE_MAP_STILE.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStil(s.id)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                s.id === stil
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <CardContent className="p-0">
        <div className={cn("w-full", height)}>
          <GoogleFleetMap
            vehicles={fleet}
            selectedId={selected}
            stil={stil}
            onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
          />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border/70 px-4 py-2.5">
          {(Object.keys(FLEET_FARBEN) as Array<keyof typeof FLEET_FARBEN>).map((k) => (
            <div key={k} className="flex items-center gap-1.5 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: FLEET_FARBEN[k].hex }}
              />
              <span className="font-medium">{FLEET_FARBEN[k].label}</span>
              <span className="text-muted-foreground">{zaehler[k]}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
