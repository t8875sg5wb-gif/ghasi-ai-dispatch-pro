/// <reference types="google.maps" />
// ============================================================
// GHASI AI – Google Maps Platform Loader & Konfiguration
// Lädt die Maps JavaScript API (Browser-Key des verbundenen
// Google-Maps-Connectors) genau einmal und stellt einen
// promise-basierten Zugriff bereit. SSR-sicher.
// ============================================================

declare global {
  interface Window {
    __ghasiGmapsCb?: () => void;
    google?: typeof google;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
  | string
  | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as
  | string
  | undefined;

let loaderPromise: Promise<typeof google.maps> | null = null;

/** Lädt die Google Maps JavaScript API (einmalig) und löst mit `google.maps` auf. */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps ist nur im Browser verfügbar."));
  }
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    if (!BROWSER_KEY) {
      reject(new Error("Kein Google-Maps-Browser-Key konfiguriert."));
      return;
    }
    window.__ghasiGmapsCb = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps wurde nicht korrekt initialisiert."));
    };

    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      callback: "__ghasiGmapsCb",
      libraries: "maps,marker",
      v: "weekly",
    });
    if (TRACKING_ID) params.set("channel", TRACKING_ID);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Google Maps konnte nicht geladen werden."));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

/* ------------------------------------------------------------------ *
 * Kartenstile (entspricht den bisherigen Layer-Optionen)
 * ------------------------------------------------------------------ */

export type GoogleMapStil = "roadmap" | "hybrid" | "dark";

export const GOOGLE_MAP_STILE: { id: GoogleMapStil; label: string }[] = [
  { id: "roadmap", label: "Straße" },
  { id: "hybrid", label: "Satellit" },
  { id: "dark", label: "Dunkel" },
];

/** Dezenter Dark-Style passend zum GHASI-AI-Theme. */
export const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1d2330" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d2330" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9aa7bd" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a3140" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#b9c4d6" }] },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#141a26" }],
  },
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#3a4252" }] },
];
