// Client-safe mapping for driver shift calendar entries.
export type ShiftTyp = "dienst" | "urlaub" | "krank" | "frei";

export const SHIFT_TYPEN: ShiftTyp[] = ["dienst", "urlaub", "krank", "frei"];

export const SHIFT_META: Record<
  ShiftTyp,
  { label: string; badge: string; dot: string; kurz: string }
> = {
  dienst: {
    label: "Dienst",
    badge: "border-primary/30 bg-primary/10 text-primary",
    dot: "bg-primary",
    kurz: "D",
  },
  urlaub: {
    label: "Urlaub",
    badge: "border-info/30 bg-info/10 text-info",
    dot: "bg-info",
    kurz: "U",
  },
  krank: {
    label: "Krank",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
    kurz: "K",
  },
  frei: {
    label: "Frei",
    badge: "border-muted-foreground/30 bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
    kurz: "F",
  },
};

export interface Shift {
  id: string;
  driverId: string;
  datum: string; // YYYY-MM-DD
  typ: ShiftTyp;
  von: string;
  bis: string;
  notiz: string;
}

export interface ShiftWrite {
  driverId: string;
  datum: string;
  typ: ShiftTyp;
  von?: string;
  bis?: string;
  notiz?: string;
}

export interface ShiftRow {
  id: string;
  driver_id: string;
  datum: string;
  typ: string;
  von: string;
  bis: string;
  notiz: string;
}

export function rowToShift(r: ShiftRow): Shift {
  return {
    id: r.id,
    driverId: r.driver_id,
    datum: r.datum,
    typ: (r.typ as ShiftTyp) ?? "dienst",
    von: r.von ?? "",
    bis: r.bis ?? "",
    notiz: r.notiz ?? "",
  };
}

export function shiftToRow(w: Partial<ShiftWrite>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (k: string, v: unknown) => {
    if (v !== undefined) row[k] = v;
  };
  set("driver_id", w.driverId);
  set("datum", w.datum);
  set("typ", w.typ);
  set("von", w.von ?? "");
  set("bis", w.bis ?? "");
  set("notiz", w.notiz ?? "");
  return row;
}

/* -------------------- date helpers (local, no TZ drift) ------------------- */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const c = new Date(d);
  const day = (c.getDay() + 6) % 7; // 0 = Monday
  c.setDate(c.getDate() - day);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/**
 * Detect double-bookings: a driver with more than one entry on the same day, or
 * a "dienst" entry on a day also marked urlaub/krank. Returns a set of
 * conflicting shift ids.
 */
export function findShiftConflicts(shifts: Shift[]): Set<string> {
  const conflicts = new Set<string>();
  const byKey = new Map<string, Shift[]>();
  for (const s of shifts) {
    const key = `${s.driverId}|${s.datum}`;
    const arr = byKey.get(key) ?? [];
    arr.push(s);
    byKey.set(key, arr);
  }
  for (const arr of byKey.values()) {
    if (arr.length > 1) {
      // Any day with multiple entries where at least one is dienst and another
      // is urlaub/krank, or simply more than one dienst, is a conflict.
      const hatDienst = arr.some((s) => s.typ === "dienst");
      const hatAbwesend = arr.some((s) => s.typ === "urlaub" || s.typ === "krank");
      const dienstCount = arr.filter((s) => s.typ === "dienst").length;
      if ((hatDienst && hatAbwesend) || dienstCount > 1) {
        arr.forEach((s) => conflicts.add(s.id));
      }
    }
  }
  return conflicts;
}
