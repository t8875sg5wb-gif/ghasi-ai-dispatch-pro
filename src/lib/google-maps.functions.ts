// ============================================================
// GHASI AI – Google Maps Platform Serverdienste (einziger Anbieter)
// Alle Geo-/Routing-/Places-Aufrufe laufen über den verbundenen
// Google-Maps-Connector-Gateway. Server-Key wird automatisch vom
// Gateway injiziert – keine manuelle Key-Verwaltung nötig.
// ============================================================
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function gatewayHeaders(extra?: Record<string, string>): Record<string, string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error("Google-Maps-Connector ist nicht konfiguriert.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
    ...extra,
  };
}

/* ------------------------------------------------------------------ *
 * Gemeinsame Typen
 * ------------------------------------------------------------------ */

export interface GeoPunkt {
  lat: number;
  lng: number;
}

export interface GeocodeErgebnis {
  lat: number;
  lng: number;
  formatiert: string;
  ort?: string;
  plz?: string;
  land?: string;
}

export interface RouteErgebnis {
  distanzMeter: number;
  distanzKm: number;
  dauerSekunden: number;
  dauerMin: number;
  polyline: string;
  hatMaut: boolean;
  mautText?: string;
}

export interface OptimierteRoute extends RouteErgebnis {
  /** Reihenfolge der Zwischenstopps (Indizes bezogen auf die Eingabe). */
  reihenfolge: number[];
}

export type PlaceKategorie =
  | "hospital"
  | "doctor"
  | "pharmacy"
  | "gas_station"
  | "electric_vehicle_charging_station";

export interface PlaceErgebnis {
  id: string;
  name: string;
  adresse: string;
  lat: number;
  lng: number;
  bewertung?: number;
  geoeffnet?: boolean;
  distanzMeter?: number;
}

/* ------------------------------------------------------------------ *
 * Eingabe-Helfer
 * ------------------------------------------------------------------ */

const punktSchema = z.object({ lat: z.number(), lng: z.number() });
const ortSchema = z.union([z.string().min(1), punktSchema]);
type OrtEingabe = string | GeoPunkt;

function toWaypoint(ort: OrtEingabe): Record<string, unknown> {
  if (typeof ort === "string") return { address: ort };
  return { location: { latLng: { latitude: ort.lat, longitude: ort.lng } } };
}

function haversine(a: GeoPunkt, b: GeoPunkt): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* ------------------------------------------------------------------ *
 * Geocoding & Reverse-Geocoding
 * ------------------------------------------------------------------ */

export const geocodeAddress = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { address: string }) => z.object({ address: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<GeocodeErgebnis | null> => {
    const res = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(data.address)}&region=de&language=de`,
      { headers: gatewayHeaders() },
    );
    if (!res.ok) throw new Error(`Geocoding fehlgeschlagen (${res.status})`);
    const json = (await res.json()) as any;
    const r = json.results?.[0];
    if (!r) return null;
    const comp = (typ: string) =>
      r.address_components?.find((c: any) => c.types?.includes(typ))?.long_name as
        | string
        | undefined;
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      formatiert: r.formatted_address,
      ort: comp("locality") ?? comp("administrative_area_level_1"),
      plz: comp("postal_code"),
      land: comp("country"),
    };
  });

export const reverseGeocode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lat: number; lng: number }) => punktSchema.parse(d))
  .handler(async ({ data }): Promise<GeocodeErgebnis | null> => {
    const res = await fetch(
      `${GATEWAY_URL}/maps/api/geocode/json?latlng=${data.lat},${data.lng}&language=de`,
      { headers: gatewayHeaders() },
    );
    if (!res.ok) throw new Error(`Reverse-Geocoding fehlgeschlagen (${res.status})`);
    const json = (await res.json()) as any;
    const r = json.results?.[0];
    if (!r) return null;
    const comp = (typ: string) =>
      r.address_components?.find((c: any) => c.types?.includes(typ))?.long_name as
        | string
        | undefined;
    return {
      lat: data.lat,
      lng: data.lng,
      formatiert: r.formatted_address,
      ort: comp("locality"),
      plz: comp("postal_code"),
      land: comp("country"),
    };
  });

/* ------------------------------------------------------------------ *
 * Routen: Distanz, ETA, Maut, Verkehr
 * ------------------------------------------------------------------ */

async function computeRoutesRaw(body: Record<string, unknown>, fieldMask: string): Promise<any> {
  const res = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: gatewayHeaders({ "Content-Type": "application/json", "X-Goog-FieldMask": fieldMask }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Routes API Fehler (${res.status}): ${t.slice(0, 200)}`);
  }
  return res.json();
}

export const computeRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { origin: OrtEingabe; destination: OrtEingabe; verkehr?: boolean; ohneMaut?: boolean }) =>
      z
        .object({
          origin: ortSchema,
          destination: ortSchema,
          verkehr: z.boolean().optional(),
          ohneMaut: z.boolean().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<RouteErgebnis | null> => {
    const body: Record<string, unknown> = {
      origin: toWaypoint(data.origin),
      destination: toWaypoint(data.destination),
      travelMode: "DRIVE",
      routingPreference: data.verkehr === false ? "TRAFFIC_UNAWARE" : "TRAFFIC_AWARE",
      extraComputations: ["TOLLS"],
      languageCode: "de-DE",
      units: "METRIC",
    };
    if (data.ohneMaut) body.routeModifiers = { avoidTolls: true };
    const json = await computeRoutesRaw(
      body,
      "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.travelAdvisory.tollInfo",
    );
    const route = json.routes?.[0];
    if (!route) return null;
    const dauer = Number(String(route.duration ?? "0s").replace("s", ""));
    const toll = route.travelAdvisory?.tollInfo;
    const mautPreis = toll?.estimatedPrice?.[0];
    return {
      distanzMeter: route.distanceMeters ?? 0,
      distanzKm: Number(((route.distanceMeters ?? 0) / 1000).toFixed(1)),
      dauerSekunden: dauer,
      dauerMin: Math.round(dauer / 60),
      polyline: route.polyline?.encodedPolyline ?? "",
      hatMaut: Boolean(toll),
      mautText: mautPreis
        ? `${mautPreis.units ?? 0} ${mautPreis.currencyCode ?? "EUR"}`
        : undefined,
    };
  });

/* ------------------------------------------------------------------ *
 * Routenoptimierung (mehrere Patienten / Stopps)
 * ------------------------------------------------------------------ */

export const optimizeRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { origin: OrtEingabe; destination: OrtEingabe; stops: OrtEingabe[] }) =>
      z
        .object({
          origin: ortSchema,
          destination: ortSchema,
          stops: z.array(ortSchema).min(1),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<OptimierteRoute | null> => {
    const json = await computeRoutesRaw(
      {
        origin: toWaypoint(data.origin),
        destination: toWaypoint(data.destination),
        intermediates: data.stops.map(toWaypoint),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        optimizeWaypointOrder: true,
        extraComputations: ["TOLLS"],
        languageCode: "de-DE",
        units: "METRIC",
      },
      "routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.travelAdvisory.tollInfo",
    );
    const route = json.routes?.[0];
    if (!route) return null;
    const dauer = Number(String(route.duration ?? "0s").replace("s", ""));
    const toll = route.travelAdvisory?.tollInfo;
    const mautPreis = toll?.estimatedPrice?.[0];
    return {
      distanzMeter: route.distanceMeters ?? 0,
      distanzKm: Number(((route.distanceMeters ?? 0) / 1000).toFixed(1)),
      dauerSekunden: dauer,
      dauerMin: Math.round(dauer / 60),
      polyline: route.polyline?.encodedPolyline ?? "",
      hatMaut: Boolean(toll),
      mautText: mautPreis
        ? `${mautPreis.units ?? 0} ${mautPreis.currencyCode ?? "EUR"}`
        : undefined,
      reihenfolge: route.optimizedIntermediateWaypointIndex ?? data.stops.map((_, i) => i),
    };
  });

/* ------------------------------------------------------------------ *
 * Places-Suche: Kliniken, Ärzte, Apotheken, Tank-/Ladesäulen
 * ------------------------------------------------------------------ */

export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      kategorie?: PlaceKategorie;
      text?: string;
      lat: number;
      lng: number;
      radius?: number;
    }) =>
      z
        .object({
          kategorie: z
            .enum([
              "hospital",
              "doctor",
              "pharmacy",
              "gas_station",
              "electric_vehicle_charging_station",
            ])
            .optional(),
          text: z.string().optional(),
          lat: z.number(),
          lng: z.number(),
          radius: z.number().min(100).max(50000).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<PlaceErgebnis[]> => {
    const center = { lat: data.lat, lng: data.lng };
    const fieldMask =
      "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours.openNow";
    let res: Response;
    if (data.text && data.text.trim()) {
      res = await fetch(`${GATEWAY_URL}/places/v1/places:searchText`, {
        method: "POST",
        headers: gatewayHeaders({
          "Content-Type": "application/json",
          "X-Goog-FieldMask": fieldMask,
        }),
        body: JSON.stringify({
          textQuery: data.text,
          languageCode: "de",
          maxResultCount: 12,
          locationBias: {
            circle: { center: { latitude: data.lat, longitude: data.lng }, radius: data.radius ?? 15000 },
          },
        }),
      });
    } else {
      res = await fetch(`${GATEWAY_URL}/places/v1/places:searchNearby`, {
        method: "POST",
        headers: gatewayHeaders({
          "Content-Type": "application/json",
          "X-Goog-FieldMask": fieldMask,
        }),
        body: JSON.stringify({
          includedTypes: [data.kategorie ?? "hospital"],
          languageCode: "de",
          maxResultCount: 15,
          locationRestriction: {
            circle: { center: { latitude: data.lat, longitude: data.lng }, radius: data.radius ?? 10000 },
          },
        }),
      });
    }
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Places API Fehler (${res.status}): ${t.slice(0, 200)}`);
    }
    const json = (await res.json()) as any;
    const places: any[] = json.places ?? [];
    return places
      .map((p) => {
        const lat = p.location?.latitude;
        const lng = p.location?.longitude;
        const punkt = { lat, lng };
        return {
          id: p.id,
          name: p.displayName?.text ?? "Unbekannt",
          adresse: p.formattedAddress ?? "",
          lat,
          lng,
          bewertung: p.rating,
          geoeffnet: p.currentOpeningHours?.openNow,
          distanzMeter:
            typeof lat === "number" && typeof lng === "number"
              ? Math.round(haversine(center, punkt))
              : undefined,
        } satisfies PlaceErgebnis;
      })
      .sort((a, b) => (a.distanzMeter ?? 1e9) - (b.distanzMeter ?? 1e9));
  });

/* ------------------------------------------------------------------ *
 * Distanzmatrix: nächstgelegene Fahrzeuge zu einem Ziel
 * ------------------------------------------------------------------ */

export const rankByDistance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ziel: OrtEingabe; quellen: GeoPunkt[] }) =>
    z.object({ ziel: ortSchema, quellen: z.array(punktSchema).min(1).max(25) }).parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{ index: number; distanzMeter: number; dauerSekunden: number }[]> => {
      const res = await fetch(`${GATEWAY_URL}/routes/distanceMatrix/v2:computeRouteMatrix`, {
        method: "POST",
        headers: gatewayHeaders({
          "Content-Type": "application/json",
          "X-Goog-FieldMask":
            "originIndex,destinationIndex,duration,distanceMeters,condition",
        }),
        body: JSON.stringify({
          origins: data.quellen.map((q) => ({ waypoint: toWaypoint(q) })),
          destinations: [{ waypoint: toWaypoint(data.ziel) }],
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`RouteMatrix Fehler (${res.status}): ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as any[];
      return (Array.isArray(json) ? json : [])
        .filter((e) => e.condition === "ROUTE_EXISTS")
        .map((e) => ({
          index: e.originIndex ?? 0,
          distanzMeter: e.distanceMeters ?? 0,
          dauerSekunden: Number(String(e.duration ?? "0s").replace("s", "")),
        }))
        .sort((a, b) => a.dauerSekunden - b.dauerSekunden);
    },
  );
