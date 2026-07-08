// ============================================================
// GHASI AI – Live-Flotten- & Transport-Execution-Layer
// Verdichtet Fahrzeuge, Fahrer und Dispatch-Transporte zu einem
// echten Live-GPS-Modell: farbcodierte Marker, Geschwindigkeit,
// ETA, Tankstand, Routen (geplant/absolviert/Rest), Zuordnung und
// automatische Alerts. Deterministisch (SSR/Hydration-stabil) und
// vollständig client-safe. Bestehende Module bleiben unangetastet.
// ============================================================
import { type Fahrzeug, type FahrzeugStatus, INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";
import { INITIAL_FAHRER, type Fahrer } from "@/lib/fahrer";
import {
  type DispatchTransport,
  type LiveStatus,
  LIVE_STATUS_META,
  generateDispatchTransporte,
} from "@/lib/dispatch";
import {
  MOBILITAET_META,
  VERORDNUNG_META,
  effektiveMobilitaet,
  effektiveVerordnung,
  empfohlenerFahrzeugtyp,
  fahrzeugPasstZuMobilitaet,
  verordnungFehlt,
  type Mobilitaet,
} from "@/lib/auftraege";

/* ------------------------------------------------------------------ *
 * Karten-Anbieter: GHASI AI nutzt ausschließlich Google Maps Platform.
 * Stile werden über GOOGLE_MAP_STILE in src/lib/google-maps.ts gesteuert.
 * ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ *
 * Farb-Status der Live-Marker
 * ------------------------------------------------------------------ */

export type FleetFarbe = "frei" | "fahrt" | "wartet" | "notfall" | "offline";

export const FLEET_FARBEN: Record<
  FleetFarbe,
  { label: string; hex: string; badge: string; dot: string }
> = {
  frei: {
    label: "Frei",
    hex: "#16a34a",
    badge: "border-success/30 bg-success/10 text-success",
    dot: "bg-success",
  },
  fahrt: {
    label: "Fährt",
    hex: "#2563eb",
    badge: "border-info/30 bg-info/10 text-info",
    dot: "bg-info",
  },
  wartet: {
    label: "Wartet",
    hex: "#ea580c",
    badge: "border-warning/30 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  notfall: {
    label: "Notfall",
    hex: "#dc2626",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  offline: {
    label: "Offline",
    hex: "#6b7280",
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

/* ------------------------------------------------------------------ *
 * Geokodierung (deterministischer Fallback, Raum Minden/Ostwestfalen)
 * ------------------------------------------------------------------ */

export interface LatLng {
  lat: number;
  lng: number;
}

// Betriebsraum Minden (NRW) inkl. Umland (Bad Oeynhausen, Petershagen,
// Porta Westfalica). Für statische Adressen nutzt die App die echte
// Geokodierung (geocodeAddress-Serverfunktion); dieser deterministische
// Fallback dient nur der SSR-stabilen Simulation ohne Netzaufruf.
const MINDEN_BOUNDS = { latMin: 52.2, latMax: 52.42, lngMin: 8.75, lngMax: 9.1 };

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Deterministische, plausible Koordinate für eine Adresse im Raum Minden. */
export function geocode(adresse: string): LatLng {
  const h = hashStr(adresse);
  const lat =
    MINDEN_BOUNDS.latMin + ((h % 1000) / 1000) * (MINDEN_BOUNDS.latMax - MINDEN_BOUNDS.latMin);
  const lng =
    MINDEN_BOUNDS.lngMin +
    (((h >>> 10) % 1000) / 1000) * (MINDEN_BOUNDS.lngMax - MINDEN_BOUNDS.lngMin);
  return { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
}


/** Erzeugt eine sanft gekrümmte Zwischenroute zwischen zwei Punkten. */
function polyline(a: LatLng, b: LatLng, segmente = 6): LatLng[] {
  const punkte: LatLng[] = [];
  const seed = hashStr(`${a.lat}${a.lng}${b.lat}${b.lng}`);
  for (let i = 0; i <= segmente; i += 1) {
    const t = i / segmente;
    // leichte Auslenkung, damit Routen nicht schnurgerade wirken
    const jitter = i === 0 || i === segmente ? 0 : (((seed >> i) % 100) / 100 - 0.5) * 0.004;
    punkte.push({
      lat: Number((a.lat + (b.lat - a.lat) * t + jitter).toFixed(5)),
      lng: Number((a.lng + (b.lng - a.lng) * t - jitter).toFixed(5)),
    });
  }
  return punkte;
}

/* ------------------------------------------------------------------ *
 * Alerts
 * ------------------------------------------------------------------ */

export type FleetAlertTyp =
  | "verordnung_fehlt"
  | "falsches_fahrzeug"
  | "rollstuhl_mismatch"
  | "trage_mismatch"
  | "verspaetung"
  | "fahrzeug_offline"
  | "fahrer_offline"
  | "gps_verloren"
  | "tank_niedrig";

export type AlertSchwere = "kritisch" | "hoch" | "mittel";

export interface FleetAlert {
  typ: FleetAlertTyp;
  schwere: AlertSchwere;
  titel: string;
  details: string;
  kennzeichen: string;
  transportNummer?: string;
}

export const ALERT_SCHWERE_META: Record<
  AlertSchwere,
  { label: string; badge: string; dot: string }
> = {
  kritisch: {
    label: "Kritisch",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  hoch: {
    label: "Hoch",
    badge: "border-warning/40 bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  mittel: {
    label: "Mittel",
    badge: "border-info/30 bg-info/10 text-info",
    dot: "bg-info",
  },
};

/* ------------------------------------------------------------------ *
 * Live-Fahrzeug-Modell
 * ------------------------------------------------------------------ */

export interface FleetAssignment {
  transport: DispatchTransport;
  pickup: LatLng;
  ziel: LatLng;
  eta: string;
  liveStatus: LiveStatus;
  mobilitaet: Mobilitaet;
  verordnungFehlt: boolean;
  begleitperson: boolean;
  fahrzeugPasst: boolean;
}

export interface FleetVehicle {
  id: string;
  nummer: string;
  kennzeichen: string;
  marke: string;
  modell: string;
  typ: Fahrzeug["typ"];
  status: FahrzeugStatus;
  farbe: FleetFarbe;
  fahrer: string | null;
  fahrerObj: Fahrer | null;
  standort: string;
  gps: LatLng;
  /** true = echte, frische GPS-Position (Fahrer teilt Standort), false = simuliert */
  istLive: boolean;
  tankstand: number;
  reichweite: number;
  /** km/h, 0 wenn steht/offline */
  geschwindigkeit: number;
  letzteAktualisierung: string;
  gpsVerloren: boolean;
  assignment: FleetAssignment | null;
  routeGeplant: LatLng[];
  routeAbsolviert: LatLng[];
  routeRest: LatLng[];
  alerts: FleetAlert[];
}

function farbeVon(v: Fahrzeug, a: FleetAssignment | null): FleetFarbe {
  if (v.status === "werkstatt" || v.status === "nicht_verfuegbar") return "offline";
  if (a?.transport.istNotfall) return "notfall";
  if (a && (a.liveStatus === "am_abholort" || a.liveStatus === "am_ziel")) return "wartet";
  if (v.status === "unterwegs") return "fahrt";
  return "frei";
}

function aktualisierung(h: number, offline: boolean, faehrt: boolean): string {
  if (offline) return `vor ${15 + (h % 20)} Min`;
  if (faehrt) return `vor ${3 + (h % 25)} Sek`;
  return `vor ${1 + (h % 4)} Min`;
}

function alertsFuer(
  v: Fahrzeug,
  fahrerObj: Fahrer | null,
  a: FleetAssignment | null,
  offline: boolean,
  gpsVerloren: boolean,
): FleetAlert[] {
  const out: FleetAlert[] = [];
  if (offline) {
    out.push({
      typ: "fahrzeug_offline",
      schwere: "hoch",
      titel: "Fahrzeug offline",
      details: `${v.kennzeichen} ist nicht verfügbar (${v.status}).`,
      kennzeichen: v.kennzeichen,
    });
  }
  if (gpsVerloren) {
    out.push({
      typ: "gps_verloren",
      schwere: "hoch",
      titel: "GPS-Signal verloren",
      details: `Für ${v.kennzeichen} liegt kein aktuelles GPS-Signal vor.`,
      kennzeichen: v.kennzeichen,
    });
  }
  if (fahrerObj && (fahrerObj.status === "krank" || fahrerObj.status === "urlaub")) {
    out.push({
      typ: "fahrer_offline",
      schwere: "mittel",
      titel: "Fahrer nicht im Dienst",
      details: `${fahrerObj.name} ist ${fahrerObj.status}.`,
      kennzeichen: v.kennzeichen,
    });
  }
  if (v.tankstand <= 20 && !offline) {
    out.push({
      typ: "tank_niedrig",
      schwere: "mittel",
      titel: "Tankstand niedrig",
      details: `${v.kennzeichen} hat nur noch ${v.tankstand}% Tank.`,
      kennzeichen: v.kennzeichen,
    });
  }
  if (a) {
    const t = a.transport;
    if (a.verordnungFehlt) {
      out.push({
        typ: "verordnung_fehlt",
        schwere: "kritisch",
        titel: "Verordnung fehlt",
        details: `${t.nummer} · ${t.patient}: keine gültige Verordnung vor Abfahrt.`,
        kennzeichen: v.kennzeichen,
        transportNummer: t.nummer,
      });
    }
    if (!a.fahrzeugPasst) {
      const rollstuhl = a.mobilitaet === "rollstuhl" || a.mobilitaet === "tragestuhl";
      const liegend = a.mobilitaet === "liegend";
      out.push({
        typ: liegend ? "trage_mismatch" : rollstuhl ? "rollstuhl_mismatch" : "falsches_fahrzeug",
        schwere: "kritisch",
        titel: liegend
          ? "Liegendtransport: Fahrzeug ungeeignet"
          : rollstuhl
            ? "Rollstuhl: Fahrzeug ungeeignet"
            : "Falscher Fahrzeugtyp",
        details: `${t.nummer}: ${MOBILITAET_META[a.mobilitaet].label} benötigt ${empfohlenerFahrzeugtyp(a.mobilitaet)}.`,
        kennzeichen: v.kennzeichen,
        transportNummer: t.nummer,
      });
    }
    if (t.verspaetungMin >= 10) {
      out.push({
        typ: "verspaetung",
        schwere: "hoch",
        titel: "Verspätung",
        details: `${t.nummer} · ${t.patient}: ${t.verspaetungMin} Min hinter Plan.`,
        kennzeichen: v.kennzeichen,
        transportNummer: t.nummer,
      });
    }
  }
  return out;
}

/** Baut das vollständige Live-Flotten-Modell. */
export function buildFleet(): FleetVehicle[] {
  const transporte = generateDispatchTransporte();

  return INITIAL_FAHRZEUGE.map((v) => {
    const h = hashStr(v.kennzeichen);
    // Prefer a fresh (<5 min) real GPS position shared by the driver.
    const realFresh =
      v.lastRealAt != null &&
      v.lastRealLat != null &&
      v.lastRealLng != null &&
      Date.now() - new Date(v.lastRealAt).getTime() < 5 * 60 * 1000;
    const gpsPos: LatLng = realFresh
      ? { lat: v.lastRealLat as number, lng: v.lastRealLng as number }
      : v.gps;
    const offline = v.status === "werkstatt" || v.status === "nicht_verfuegbar";

    // aktiver Transport für dieses Fahrzeug (am weitesten in der Pipeline)
    const transport =
      transporte
        .filter(
          (t) =>
            t.fahrzeug === v.kennzeichen &&
            t.liveStatus !== "abgeschlossen" &&
            t.liveStatus !== "storniert",
        )
        .sort(
          (a, b) => LIVE_STATUS_META[b.liveStatus].stufe - LIVE_STATUS_META[a.liveStatus].stufe,
        )[0] ?? null;

    let assignment: FleetAssignment | null = null;
    let routeGeplant: LatLng[] = [];
    let routeAbsolviert: LatLng[] = [];
    let routeRest: LatLng[] = [];

    if (transport) {
      const pickup = geocode(transport.abholort);
      const ziel = geocode(transport.zielort);
      const mob = effektiveMobilitaet(transport);
      const passt = fahrzeugPasstZuMobilitaet(mob, {
        rollstuhlGeeignet: v.rollstuhlGeeignet,
        liegendGeeignet: v.liegendGeeignet,
      });
      assignment = {
        transport,
        pickup,
        ziel,
        eta: transport.ankunftzeit,
        liveStatus: transport.liveStatus,
        mobilitaet: mob,
        verordnungFehlt: verordnungFehlt(effektiveVerordnung(transport)),
        begleitperson: Boolean(transport.begleitperson),
        fahrzeugPasst: passt,
      };

      const stufe = LIVE_STATUS_META[transport.liveStatus].stufe;
      const patientAnBord = stufe >= LIVE_STATUS_META.patient_an_bord.stufe;
      // Gesamte geplante Route: Pickup -> Ziel
      routeGeplant = polyline(pickup, ziel, 8);
      if (patientAnBord) {
        // unterwegs zum Ziel: absolviert = Pickup -> aktuelle Position, Rest = Position -> Ziel
        routeAbsolviert = polyline(pickup, gpsPos, 5);
        routeRest = polyline(gpsPos, ziel, 6);
      } else {
        // Anfahrt zum Patienten: absolviert = Start -> Position, Rest = Position -> Pickup -> Ziel
        routeAbsolviert = [];
        routeRest = [...polyline(gpsPos, pickup, 5), ...polyline(pickup, ziel, 8)];
      }
    }

    const farbe = farbeVon(v, assignment);
    const faehrt = farbe === "fahrt" || farbe === "notfall";
    const gpsVerloren = !offline && h % 17 === 0; // seltenes, deterministisches Signal-Aussetzen
    const geschwindigkeit = gpsVerloren ? 0 : faehrt ? 22 + (h % 38) : 0;
    const fahrerObj = INITIAL_FAHRER.find((f) => f.name === v.fahrer) ?? null;

    return {
      id: v.id,
      nummer: v.nummer,
      kennzeichen: v.kennzeichen,
      marke: v.marke,
      modell: v.modell,
      typ: v.typ,
      status: v.status,
      farbe,
      fahrer: v.fahrer,
      fahrerObj,
      standort: v.standort,
      gps: gpsPos,
      istLive: realFresh,
      tankstand: v.tankstand,
      reichweite: v.reichweite,
      geschwindigkeit,
      letzteAktualisierung: aktualisierung(h, offline, faehrt),
      gpsVerloren,
      assignment,
      routeGeplant,
      routeAbsolviert,
      routeRest,
      alerts: alertsFuer(v, fahrerObj, assignment, offline, gpsVerloren),
    } satisfies FleetVehicle;
  });
}

/** Alle aktiven Flotten-Alerts, nach Schwere sortiert. */
export function computeFleetAlerts(fleet?: FleetVehicle[]): FleetAlert[] {
  const rang: Record<AlertSchwere, number> = { kritisch: 0, hoch: 1, mittel: 2 };
  return (fleet ?? buildFleet())
    .flatMap((v) => v.alerts)
    .sort((a, b) => rang[a.schwere] - rang[b.schwere]);
}

/** Findet ein Fahrzeug per Kennzeichen/Nummer/Fahrername (für die KI). */
export function findVehicle(query: string, fleet?: FleetVehicle[]): FleetVehicle | null {
  const q = query.toLowerCase().replace(/[\s-]/g, "");
  const list = fleet ?? buildFleet();
  return (
    list.find((v) => {
      const kennz = v.kennzeichen.toLowerCase().replace(/[\s-]/g, "");
      return (
        kennz.includes(q) ||
        v.nummer.toLowerCase().replace(/[\s-]/g, "").includes(q) ||
        (v.fahrer ?? "").toLowerCase().replace(/[\s-]/g, "").includes(q)
      );
    }) ?? null
  );
}

/* ------------------------------------------------------------------ *
 * Wissens-Snapshot für die KI (Live-GPS / Execution)
 * ------------------------------------------------------------------ */

export function buildGpsSnapshot(): string {
  const fleet = buildFleet();
  const lines: string[] = [];
  lines.push(`# Live-GPS & Transport-Execution (Stand jetzt)`);

  const zaehler: Record<FleetFarbe, number> = {
    frei: 0,
    fahrt: 0,
    wartet: 0,
    notfall: 0,
    offline: 0,
  };
  for (const v of fleet) zaehler[v.farbe] += 1;
  lines.push(
    `Status: ${zaehler.frei} frei (grün), ${zaehler.fahrt} fahren (blau), ${zaehler.wartet} warten (orange), ` +
      `${zaehler.notfall} Notfall (rot), ${zaehler.offline} offline (grau).`,
  );

  lines.push(`\n## Fahrzeuge live`);
  for (const v of fleet) {
    const a = v.assignment;
    lines.push(
      `- ${v.kennzeichen} (${v.typ}, Fahrer ${v.fahrer ?? "—"}): ${FLEET_FARBEN[v.farbe].label}, ` +
        `Standort „${v.standort}" (${v.gps.lat}, ${v.gps.lng}), Tempo ${v.geschwindigkeit} km/h, ` +
        `Tank ${v.tankstand}%, Update ${v.letzteAktualisierung}.` +
        (a
          ? ` Auftrag ${a.transport.nummer} · ${a.transport.patient}: ${LIVE_STATUS_META[a.liveStatus].label}, ` +
            `${a.transport.abholort} → ${a.transport.zielort}, ETA ${a.eta}, ` +
            `Mobilität ${MOBILITAET_META[a.mobilitaet].label}, ` +
            `Verordnung ${a.verordnungFehlt ? "FEHLT" : VERORDNUNG_META[effektiveVerordnung(a.transport)].label}, ` +
            `Begleitung ${a.begleitperson ? "Ja" : "Nein"}, ` +
            `Fahrzeug passt: ${a.fahrzeugPasst ? "Ja" : "NEIN"}.`
          : ` Kein aktiver Transport.`),
    );
  }

  const alerts = computeFleetAlerts(fleet);
  lines.push(`\n## Aktive Alerts (${alerts.length})`);
  if (alerts.length === 0) lines.push(`- Keine.`);
  for (const al of alerts) {
    lines.push(
      `- [${ALERT_SCHWERE_META[al.schwere].label}] ${al.titel} (${al.kennzeichen}): ${al.details}`,
    );
  }

  return lines.join("\n");
}
