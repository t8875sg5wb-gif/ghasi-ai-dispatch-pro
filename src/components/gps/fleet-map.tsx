// Client-only Leaflet Fleet-Map. Imperativ aufgebaut (dynamischer Import),
// damit kein SSR/Hydration-Problem entsteht. Unterstützt Zoom, Pan,
// Vollbild, Layer-Wechsel (Straße/Dunkel/Satellit), farbcodierte
// Live-Marker, reichhaltige Popups und Routen (geplant/absolviert/Rest).
import { useEffect, useRef } from "react";
import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
  TileLayer as LeafletTileLayer,
  LayerGroup as LeafletLayerGroup,
} from "leaflet";

import {
  type FleetVehicle,
  type KartenAnbieter,
  FLEET_FARBEN,
  KARTEN_ANBIETER,
} from "@/lib/fleet-live";
import { LIVE_STATUS_META } from "@/lib/dispatch";
import { MOBILITAET_META } from "@/lib/auftraege";

type L = typeof import("leaflet");

const BERLIN: [number, number] = [52.51, 13.4];

function markerHtml(v: FleetVehicle, selected: boolean): string {
  const hex = FLEET_FARBEN[v.farbe].hex;
  const ring = selected ? "box-shadow:0 0 0 4px rgba(37,99,235,.35);" : "";
  const puls =
    v.farbe === "fahrt" || v.farbe === "notfall"
      ? `<span style="position:absolute;inset:-6px;border-radius:9999px;background:${hex};opacity:.25;animation:ghasi-ping 1.4s cubic-bezier(0,0,.2,1) infinite;"></span>`
      : "";
  return `
    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
      ${puls}
      <div style="position:relative;width:30px;height:30px;border-radius:9999px;background:${hex};border:3px solid #fff;${ring}display:flex;align-items:center;justify-content:center;transition:transform .15s;${selected ? "transform:scale(1.18);" : ""}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
      </div>
    </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function popupHtml(v: FleetVehicle): string {
  const a = v.assignment;
  const row = (label: string, value: string) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;line-height:1.5;"><span style="color:#64748b;">${label}</span><span style="font-weight:600;text-align:right;">${escapeHtml(value)}</span></div>`;
  const farbe = FLEET_FARBEN[v.farbe];
  let html = `<div style="min-width:230px;font-family:inherit;">
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

export function FleetMap({
  vehicles,
  selectedId,
  anbieter,
  onSelect,
}: {
  vehicles: FleetVehicle[];
  selectedId: string | null;
  anbieter: KartenAnbieter;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<L | null>(null);
  const tileRef = useRef<LeafletTileLayer | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const routeLayerRef = useRef<LeafletLayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Karte initialisieren (einmalig, client-only)
  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      const Lmod = (await import("leaflet")) as unknown as L;
      if (abgebrochen || !containerRef.current || mapRef.current) return;
      leafletRef.current = Lmod;

      const map = Lmod.map(containerRef.current, {
        center: BERLIN,
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;
      routeLayerRef.current = Lmod.layerGroup().addTo(map);

      const start = KARTEN_ANBIETER[0];
      tileRef.current = Lmod.tileLayer(start.url as string, {
        attribution: start.attribution,
        maxZoom: start.maxZoom,
      }).addTo(map);

      // Container-Größe nach Mount korrekt berechnen
      setTimeout(() => map.invalidateSize(), 120);
    })();

    return () => {
      abgebrochen = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  // Tile-Anbieter wechseln
  useEffect(() => {
    const Lmod = leafletRef.current;
    const map = mapRef.current;
    if (!Lmod || !map || !anbieter.url) return;
    if (tileRef.current) tileRef.current.remove();
    tileRef.current = Lmod.tileLayer(anbieter.url, {
      attribution: anbieter.attribution,
      maxZoom: anbieter.maxZoom,
    }).addTo(map);
  }, [anbieter]);

  // Marker synchronisieren (Live-Update)
  useEffect(() => {
    const Lmod = leafletRef.current;
    const map = mapRef.current;
    if (!Lmod || !map) return;

    const lebende = new Set(vehicles.map((v) => v.id));
    for (const [id, m] of markersRef.current) {
      if (!lebende.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }

    for (const v of vehicles) {
      const selected = v.id === selectedId;
      const icon = Lmod.divIcon({
        html: markerHtml(v, selected),
        className: "ghasi-fleet-marker",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      let marker = markersRef.current.get(v.id);
      if (!marker) {
        marker = Lmod.marker([v.gps.lat, v.gps.lng], { icon, zIndexOffset: selected ? 1000 : 0 });
        marker.on("click", () => onSelectRef.current(v.id));
        marker.addTo(map);
        markersRef.current.set(v.id, marker);
      } else {
        marker.setLatLng([v.gps.lat, v.gps.lng]);
        marker.setIcon(icon);
        marker.setZIndexOffset(selected ? 1000 : 0);
      }
      marker.bindPopup(popupHtml(v), { closeButton: true, maxWidth: 280 });
    }
  }, [vehicles, selectedId]);

  // Routen + Fokus für ausgewähltes Fahrzeug
  useEffect(() => {
    const Lmod = leafletRef.current;
    const map = mapRef.current;
    const layer = routeLayerRef.current;
    if (!Lmod || !map || !layer) return;
    layer.clearLayers();

    if (!selectedId) return;
    const v = vehicles.find((x) => x.id === selectedId);
    if (!v) return;

    const toLatLng = (p: { lat: number; lng: number }): [number, number] => [p.lat, p.lng];
    const a = v.assignment;

    if (a) {
      if (v.routeAbsolviert.length > 1) {
        Lmod.polyline(v.routeAbsolviert.map(toLatLng), {
          color: "#16a34a",
          weight: 4,
          opacity: 0.85,
        }).addTo(layer);
      }
      if (v.routeRest.length > 1) {
        Lmod.polyline(v.routeRest.map(toLatLng), {
          color: "#2563eb",
          weight: 4,
          opacity: 0.85,
          dashArray: "8 8",
        }).addTo(layer);
      }
      // Abhol- & Zielmarker
      Lmod.marker(toLatLng(a.pickup), {
        icon: Lmod.divIcon({
          html: `<div style="width:18px;height:18px;border-radius:9999px;background:#0ea5e9;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>`,
          className: "ghasi-fleet-marker",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      })
        .bindPopup(`<strong>Abholort</strong><br/>${escapeHtml(a.transport.abholort)}`)
        .addTo(layer);
      Lmod.marker(toLatLng(a.ziel), {
        icon: Lmod.divIcon({
          html: `<div style="width:18px;height:18px;border-radius:4px;background:#dc2626;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);"></div>`,
          className: "ghasi-fleet-marker",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      })
        .bindPopup(`<strong>Zielort</strong><br/>${escapeHtml(a.transport.zielort)}`)
        .addTo(layer);

      const bounds = Lmod.latLngBounds([
        toLatLng(v.gps),
        toLatLng(a.pickup),
        toLatLng(a.ziel),
      ]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    } else {
      map.setView(toLatLng(v.gps), 14, { animate: true });
    }

    const m = markersRef.current.get(selectedId);
    m?.openPopup();
  }, [selectedId, vehicles]);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen?.();
    }
    setTimeout(() => mapRef.current?.invalidateSize(), 250);
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <button
        type="button"
        onClick={handleFullscreen}
        aria-label="Vollbild"
        className="absolute right-3 top-3 z-[500] flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background/90 text-foreground shadow-card backdrop-blur transition-colors hover:bg-muted"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>
    </div>
  );
}
