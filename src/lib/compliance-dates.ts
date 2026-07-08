// Shared helpers for expiry / validity dates used across compliance surfaces
// (patient approvals, driver documents, vehicle TÜV, insurance renewals).

export type FristStatus = "ok" | "bald" | "abgelaufen" | "fehlt";

export interface FristInfo {
  status: FristStatus;
  /** days until expiry (negative = expired); null when no date */
  tage: number | null;
  label: string;
}

/** Classify an ISO date as ok / expiring soon (≤ warnTage) / expired / missing. */
export function fristStatus(iso: string | null | undefined, warnTage = 30): FristInfo {
  if (!iso) return { status: "fehlt", tage: null, label: "fehlt" };
  const ziel = new Date(iso);
  if (Number.isNaN(ziel.getTime())) return { status: "fehlt", tage: null, label: "fehlt" };
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  ziel.setHours(0, 0, 0, 0);
  const tage = Math.round((ziel.getTime() - heute.getTime()) / 86_400_000);
  if (tage < 0) return { status: "abgelaufen", tage, label: `abgelaufen (${Math.abs(tage)} Tage)` };
  if (tage <= warnTage) return { status: "bald", tage, label: `läuft in ${tage} Tagen ab` };
  return { status: "ok", tage, label: `gültig bis ${formatDatumDE(iso)}` };
}

export function formatDatumDE(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-DE");
}

/** Tailwind badge classes for a status. */
export const FRIST_BADGE: Record<FristStatus, string> = {
  ok: "border-success/30 bg-success/10 text-success",
  bald: "border-warning/30 bg-warning/10 text-warning",
  abgelaufen: "border-destructive/30 bg-destructive/10 text-destructive",
  fehlt: "border-muted bg-muted text-muted-foreground",
};
