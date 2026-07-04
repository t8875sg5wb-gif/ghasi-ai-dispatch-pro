// Client-only Google-Maps Fleet-Map. Imperativ aufgebaut (dynamischer
// Loader), damit kein SSR/Hydration-Problem entsteht. Unterstützt Zoom,
// Pan, Vollbild, Kartenstil (Straße/Satellit/Dunkel), farbcodierte
// Live-Marker, reichhaltige Info-Fenster und Routen (absolviert/Rest).
import { useEffect, useRef } from "react";

import { type FleetVehicle, FLEET_FARBEN } from "@/lib/fleet-live";
import { LIVE_STATUS_META } from "@/lib/dispatch";
import { MOBILITAET_META } from "@/lib/auftraege";
import {
  type GoogleMapStil,
  DARK_MAP_STYLES,
  loadGoogleMaps,
} from "@/lib/google-maps";

const MINDEN: google.maps.LatLngLiteral = { lat: 52.2887, lng: 8.9167 };

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function markerIcon(maps: typeof google.maps, v: FleetVehicle, selected: boolean) {
  const hex = FLEET_FARBEN[v.farbe].hex;
  const ring = selected
    ? `<circle cx="17" cy="17" r="16" fill="none" stroke="#2563eb" stroke-width="2.5" opacity="0.55"/>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    ${ring}
    <circle cx="17" cy="17" r="13" fill="${hex}" stroke="#fff" stroke-width="3"/>
    <g transform="translate(9.5,9.5)" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/>
      <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </g>
  </svg>`.replace(/\s+/g, " ");
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(34, 34),
    anchor: new maps.Point(17, 17),
  };
}

function popupHtml(v: FleetVehicle): string {
  const a = v.assignment;
  const row = (label: string, value: string) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;line-height:1.5;"><span style="color:#64748b;">${label}</span><span style="font-weight:600;text-align:right;">${escapeHtml(value)}</span></div>`;
  const farbe = FLEET_FARBEN[v.farbe];
  let html = `<div style="min-width:230px;font-family:inherit;color:#0f172a;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="width:10px;height:10px;border-radius:9999px;background:${farbe.hex};"></span>
      <strong style="font-size:14px;">${escapeHtml(v.kennzeichen)}</strong>
      <span style="font-size:11px;color:#64748b;">${escapeHtml(v.typ)}</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px;">
      ${row("Fahrer", v.fahrer ?? "—")}
      ${row("Status", farbe.label)}
      ${row("Tempo", `${v.geschwindigkeit} km/h`)}
      ${row("Tank", `${v.tankstand}%`)}
      ${row("Position", v.standort)}
      ${row("Update", v.letzteAktualisierung)}`;
  if (a) {
    html += `
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:8px 0;" />
      ${row("Auftrag", `${a.transport.nummer}`)}
      ${row("Patient", a.transport.patient)}
      ${row("Phase", LIVE_STATUS_META[a.liveStatus].label)}
      ${row("Mobilität", MOBILITAET_META[a.mobilitaet].label)}
      ${row("Verordnung", a.verordnungFehlt ? "FEHLT" : "Vorhanden")}
      ${row("Begleitung", a.begleitperson ? "Ja" : "Nein")}
      ${row("ETA", a.eta)}`;
  } else {
    html += `<hr style="border:none;border-top:1px solid #e2e8f0;margin:8px 0;" /><div style="font-size:12px;color:#64748b;">Kein aktiver Transport.</div>`;
  }
  html += `</div></div>`;
  return html;
}

export function GoogleFleetMap({
  vehicles,
  selectedId,
  stil = "roadmap",
  onSelect,
}: {
  vehicles: FleetVehicle[];
  selectedId: string | null;
  stil?: GoogleMapStil;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<typeof google.maps | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const routesRef = useRef<google.maps.Polyline[]>([]);
  const routeMarkersRef = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Karte initialisieren (einmalig, client-only)
  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      try {
        const maps = await loadGoogleMaps();
        if (abgebrochen || !containerRef.current || mapRef.current) return;
        mapsRef.current = maps;
        mapRef.current = new maps.Map(containerRef.current, {
          center: MINDEN,
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        });
        infoRef.current = new maps.InfoWindow();
      } catch (e) {
        console.error("Google Maps Init fehlgeschlagen:", e);
      }
    })();
    return () => {
      abgebrochen = true;
      for (const m of markersRef.current.values()) m.setMap(null);
      markersRef.current.clear();
      mapRef.current = null;
    };
  }, []);

  // Kartenstil wechseln
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    if (stil === "hybrid") {
      map.setMapTypeId("hybrid");
      map.setOptions({ styles: [] });
    } else if (stil === "dark") {
      map.setMapTypeId("roadmap");
      map.setOptions({ styles: DARK_MAP_STYLES });
    } else {
      map.setMapTypeId("roadmap");
      map.setOptions({ styles: [] });
    }
  }, [stil, vehicles.length]);

  // Marker synchronisieren (Live-Update)
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    const lebende = new Set(vehicles.map((v) => v.id));
    for (const [id, m] of markersRef.current) {
      if (!lebende.has(id)) {
        m.setMap(null);
        markersRef.current.delete(id);
      }
    }

    for (const v of vehicles) {
      const selected = v.id === selectedId;
      let marker = markersRef.current.get(v.id);
      if (!marker) {
        marker = new maps.Marker({
          position: v.gps,
          map,
          icon: markerIcon(maps, v, selected),
          zIndex: selected ? 1000 : 1,
        });
        marker.addListener("click", () => onSelectRef.current(v.id));
        markersRef.current.set(v.id, marker);
      } else {
        marker.setPosition(v.gps);
        marker.setIcon(markerIcon(maps, v, selected));
        marker.setZIndex(selected ? 1000 : 1);
      }
    }
  }, [vehicles, selectedId]);

  // Routen + Fokus für ausgewähltes Fahrzeug
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    for (const p of routesRef.current) p.setMap(null);
    routesRef.current = [];
    for (const m of routeMarkersRef.current) m.setMap(null);
    routeMarkersRef.current = [];

    if (!selectedId) return;
    const v = vehicles.find((x) => x.id === selectedId);
    if (!v) return;

    const a = v.assignment;
    if (a) {
      if (v.routeAbsolviert.length > 1) {
        routesRef.current.push(
          new maps.Polyline({
            path: v.routeAbsolviert,
            map,
            strokeColor: "#16a34a",
            strokeOpacity: 0.85,
            strokeWeight: 4,
          }),
        );
      }
      if (v.routeRest.length > 1) {
        routesRef.current.push(
          new maps.Polyline({
            path: v.routeRest,
            map,
            strokeColor: "#2563eb",
            strokeOpacity: 0,
            strokeWeight: 4,
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeOpacity: 0.85, scale: 3 },
                offset: "0",
                repeat: "14px",
              },
            ],
          }),
        );
      }
      routeMarkersRef.current.push(
        new maps.Marker({
          position: a.pickup,
          map,
          title: a.transport.abholort,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#0ea5e9",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 3,
          },
        }),
      );
      routeMarkersRef.current.push(
        new maps.Marker({
          position: a.ziel,
          map,
          title: a.transport.zielort,
          icon: {
            path: maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 5,
            fillColor: "#dc2626",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        }),
      );

      const bounds = new maps.LatLngBounds();
      bounds.extend(v.gps);
      bounds.extend(a.pickup);
      bounds.extend(a.ziel);
      map.fitBounds(bounds, 60);
    } else {
      map.setCenter(v.gps);
      map.setZoom(14);
    }

    const marker = markersRef.current.get(selectedId);
    if (marker && infoRef.current) {
      infoRef.current.setContent(popupHtml(v));
      infoRef.current.open({ map, anchor: marker });
    }
  }, [selectedId, vehicles]);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <button
        type="button"
        onClick={handleFullscreen}
        aria-label="Vollbild"
        className="absolute right-3 top-3 z-[5] flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background/90 text-foreground shadow-card backdrop-blur transition-colors hover:bg-muted"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>
    </div>
  );
}
