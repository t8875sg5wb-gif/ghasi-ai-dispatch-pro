// Client-safe types & helpers for the AI Verordnungs-Scan (Muster 4).
// The server function extracts these fields from a photo; the UI confirms
// them before anything is persisted (health/billing data is never auto-saved).
import type { Mobilitaet, Transportart } from "@/lib/auftraege";
import type { Patient, Krankenkasse } from "@/lib/stammdaten";

export type ScanTransportart = "Rollstuhl" | "Tragestuhl" | "liegend" | "sitzend";

export interface ScannedVerordnung {
  patientName: string | null;
  geburtsdatum: string | null; // as printed or ISO
  krankenkasse: string | null;
  versichertennummer: string | null;
  transportart: ScanTransportart | null;
  /** true = Dauerfahrt (recurring), false = Einzelfahrt, null = unknown */
  dauerfahrt: boolean | null;
  gueltigVon: string | null; // ISO date if found
  gueltigBis: string | null; // ISO date if found
  arzt: string | null;
}

export interface ScanResult {
  ok: boolean;
  data: ScannedVerordnung;
  /** Present on failure – a user-facing German message. */
  fehler?: string;
}

export function emptyScan(): ScannedVerordnung {
  return {
    patientName: null,
    geburtsdatum: null,
    krankenkasse: null,
    versichertennummer: null,
    transportart: null,
    dauerfahrt: null,
    gueltigVon: null,
    gueltigBis: null,
    arzt: null,
  };
}

/** Map the scanned transport type to the internal patient mobility value. */
export function scanArtZuPatientMobilitaet(a: ScanTransportart | null): Patient["mobilitaet"] {
  switch (a) {
    case "Rollstuhl":
    case "Tragestuhl":
      return "Rollstuhl";
    case "liegend":
      return "Liegend";
    case "sitzend":
      return "Gehfähig";
    default:
      return "Gehfähig";
  }
}

/** Map the scanned transport type to the internal order mobility value. */
export function scanArtZuMobilitaet(a: ScanTransportart | null): Mobilitaet {
  switch (a) {
    case "Rollstuhl":
      return "rollstuhl";
    case "Tragestuhl":
      return "tragestuhl";
    case "liegend":
      return "liegend";
    default:
      return "gehfaehig";
  }
}

/** Map the scanned transport type to the internal order transport category. */
export function scanArtZuTransportart(a: ScanTransportart | null): Transportart {
  switch (a) {
    case "Rollstuhl":
    case "Tragestuhl":
      return "Rollstuhl";
    case "liegend":
      return "Liegendtransport";
    default:
      return "Sitzendtransport";
  }
}

export const SCAN_ART_LABEL: Record<ScanTransportart, string> = {
  Rollstuhl: "Rollstuhl",
  Tragestuhl: "Tragestuhl",
  liegend: "Liegendtransport",
  sitzend: "Sitzend / gehfähig",
};

// --- Fuzzy name matching ------------------------------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** Similarity 0..1 that is token-order insensitive ("Bauer Johann" ~ "Johann Bauer"). */
export function nameAehnlichkeit(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const sortTokens = (s: string) => s.split(" ").sort().join(" ");
  const sa = sortTokens(na);
  const sb = sortTokens(nb);
  const dist = levenshtein(sa, sb);
  const maxLen = Math.max(sa.length, sb.length);
  return maxLen === 0 ? 0 : 1 - dist / maxLen;
}

export interface PatientMatch {
  patient: Patient;
  score: number;
}

/** Best fuzzy patient match above a threshold, or null. */
export function findePatientMatch(name: string | null, patients: Patient[]): PatientMatch | null {
  if (!name?.trim()) return null;
  let best: PatientMatch | null = null;
  for (const p of patients) {
    const score = nameAehnlichkeit(name, p.name);
    if (!best || score > best.score) best = { patient: p, score };
  }
  return best && best.score >= 0.6 ? best : null;
}

/** Best matching insurer for a scanned Krankenkasse name, or null. */
export function findeKasseMatch(
  name: string | null,
  kassen: Krankenkasse[],
): Krankenkasse | null {
  if (!name?.trim()) return null;
  let best: { kasse: Krankenkasse; score: number } | null = null;
  for (const k of kassen) {
    const score = Math.max(nameAehnlichkeit(name, k.name), nameAehnlichkeit(name, k.kuerzel));
    if (!best || score > best.score) best = { kasse: k, score };
  }
  return best && best.score >= 0.5 ? best.kasse : null;
}
