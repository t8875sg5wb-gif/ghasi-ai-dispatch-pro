export const BUSINESS_TIME_ZONE = "Europe/Berlin";

/** Kalendertag eines Zeitpunkts in der betrieblichen Zeitzone (YYYY-MM-DD). */
export function businessDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (!Number.isFinite(date.getTime())) throw new Error("Ungültiger Zeitpunkt.");
  const p = partsInZone(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

interface DateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInZone(date: Date, timeZone = BUSINESS_TIME_ZONE): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "NaN");
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function utcFromParts(p: DateParts): number {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

function equalParts(a: DateParts, b: DateParts): boolean {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

/** Lokale Betriebszeit (Europe/Berlin) -> echter UTC-Zeitpunkt. */
export function localInputToIso(local: string): string {
  const match = LOCAL_RE.exec(local);
  if (!match) throw new Error("Ungültiger lokaler Termin.");
  const target: DateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
  const wallMs = utcFromParts(target);
  let instantMs = wallMs;
  for (let i = 0; i < 4; i += 1) {
    const shown = partsInZone(new Date(instantMs));
    const offsetMs = utcFromParts(shown) - instantMs;
    const next = wallMs - offsetMs;
    if (next === instantMs) break;
    instantMs = next;
  }
  const result = new Date(instantMs);
  if (!Number.isFinite(result.getTime()) || !equalParts(partsInZone(result), target)) {
    throw new Error("Dieser lokale Termin existiert in Europe/Berlin nicht eindeutig.");
  }
  return result.toISOString();
}

/** Gespeicherter ISO-Zeitpunkt -> lokale Betriebszeit für `datetime-local`. */
export function isoToLocalInput(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new Error("Ungültiger gespeicherter Termin.");
  const p = partsInZone(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Normalisiert alte lokale Auftragszeiten oder echte ISO-Zeitpunkte auf UTC-ISO. */
export function normalizeOrderInstant(value: string): string {
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) throw new Error("Ungültiger Auftragstermin.");
    return d.toISOString();
  }
  return localInputToIso(value);
}
