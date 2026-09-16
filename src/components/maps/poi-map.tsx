// ============================================================
// GHASI AI – Wiederverwendbare Google-Maps POI-Karte
// Zeigt einen Mittelpunkt (z. B. Betriebshof) plus Ergebnis-Marker
// (Kliniken, Apotheken, Tankstellen …) und optional einen Radius als
// Service-Gebiet. Client-only, imperativ über den Google-Loader.
// ============================================================
import { useEffect, useRef, useState } from "react";

import { DARK_MAP_STYLES, loadGoogleMaps, type GoogleMapStil } from "@/lib/google-maps";

export interface PoiMarker {
  id: string;
  lat: number;
  lng: number;
  name: string;
  farbe?: string;
}

interface PoiMapProps {
  center: { lat: number; lng: number };
  marker: PoiMarker[];
  /** Service-Radius in Metern (Kreis um center). */
  radiusMeter?: number;
  stil?: GoogleMapStil;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}

function pin(maps: typeof google.maps, farbe: string, selektiert: boolean) {
  const r = selektiert ? 11 : 8;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="${r}" fill="${farbe}" stroke="#fff" stroke-width="3"/></svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(28, 28),
    anchor: new maps.Point(14, 14),
  };
}

export function PoiMap({
  center,
  marker,
  radiusMeter,
  stil = "roadmap",
  selectedId,
  onSelect,
  className,
}: PoiMapProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapsRef = useRef<typeof google.maps | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const centerMarkerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const [ladefehler, setLadefehler] = useState<string | null>(null);

  // Init
  useEffect(() => {
    let cancelled = false;
    setLadefehler(null);
    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !boxRef.current) return;
        mapsRef.current = maps;
        mapRef.current = new maps.Map(boxRef.current, {
          center,
          zoom: 12,
          disableDefaultUI: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        });
      })
      .catch((e) => {
        console.error("PoiMap Ladefehler", e);
        setLadefehler(
          "Google Maps ist im Browser noch nicht vollstÃ¤ndig freigeschaltet. Browser-Key und erlaubten Referrer prÃ¼fen.",
        );
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stil
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (stil === "hybrid") map.setMapTypeId("hybrid");
    else {
      map.setMapTypeId("roadmap");
      map.setOptions({ styles: stil === "dark" ? DARK_MAP_STYLES : [] });
    }
  }, [stil]);

  // Zentrum + Radius
  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;
    map.setCenter(center);
    if (!centerMarkerRef.current) {
      centerMarkerRef.current = new maps.Marker({
        map,
        position: center,
        icon: pin(maps, "#2563eb", true),
        title: "Betriebshof",
        zIndex: 999,
      });
    } else {
      centerMarkerRef.current.setPosition(center);
    }
    if (radiusMeter) {
      if (!circleRef.current) {
        circleRef.current = new maps.Circle({
          map,
          center,
          radius: radiusMeter,
          strokeColor: "#2563eb",
          strokeOpacity: 0.6,
          strokeWeight: 1.5,
          fillColor: "#2563eb",
          fillOpacity: 0.08,
        });
      } else {
        circleRef.current.setCenter(center);
        circleRef.current.setRadius(radiusMeter);
        circleRef.current.setMap(map);
      }
    } else if (circleRef.current) {
      circleRef.current.setMap(null);
    }
  }, [center, radiusMeter]);

  // Ergebnis-Marker
  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    const bounds = new maps.LatLngBounds();
    bounds.extend(center);
    marker.forEach((m) => {
      const gm = new maps.Marker({
        map,
        position: { lat: m.lat, lng: m.lng },
        icon: pin(maps, m.farbe ?? "#dc2626", m.id === selectedId),
        title: m.name,
      });
      gm.addListener("click", () => onSelect?.(m.id));
      markersRef.current.push(gm);
      bounds.extend({ lat: m.lat, lng: m.lng });
    });
    if (marker.length > 0) {
      map.fitBounds(bounds, 60);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marker, selectedId]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div ref={boxRef} className="h-full w-full" />
      {ladefehler && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 p-5 text-center backdrop-blur-sm">
          <div className="max-w-sm rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            <p className="font-semibold">Karte nicht verfÃ¼gbar</p>
            <p className="mt-1 text-xs leading-relaxed">{ladefehler}</p>
          </div>
        </div>
      )}
    </div>
  );
}
