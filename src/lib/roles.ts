// GHASI AI – Rollen & Berechtigungen.
// Eine einzige Quelle der Wahrheit für rollenbasierte Zugriffe (Client + Server).
// Die KI ist grundsätzlich nur lesend/beratend; diese Matrix steuert,
// welche Unternehmensbereiche eine Rolle abfragen darf.

export type AppRole = "admin" | "disposition" | "finanz" | "fahrer";

export type Bereich =
  | "transporte"
  | "fahrer"
  | "fahrzeuge"
  | "patienten"
  | "kunden"
  | "finanzen"
  | "kpis"
  | "suche";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrator",
  disposition: "Disposition",
  finanz: "Finanzen",
  fahrer: "Fahrer",
};

export const ROLE_BESCHREIBUNG: Record<AppRole, string> = {
  admin: "Voller Zugriff auf alle Module und das KI-Audit.",
  disposition: "Betrieb, Touren, Fahrer, Fahrzeuge & Patienten – ohne Finanzen.",
  finanz: "Rechnungen, Buchhaltung, Kunden & Kennzahlen – ohne operative Dispo.",
  fahrer: "Eigene Touren, Fahrzeuge & Patienten – keine Finanzdaten.",
};

const ALLE_BEREICHE: Bereich[] = [
  "transporte",
  "fahrer",
  "fahrzeuge",
  "patienten",
  "kunden",
  "finanzen",
  "kpis",
  "suche",
];

/** Welche Bereiche darf eine Rolle über die KI abfragen? */
export const ROLE_BEREICHE: Record<AppRole, Bereich[]> = {
  admin: ALLE_BEREICHE,
  disposition: ["transporte", "fahrer", "fahrzeuge", "patienten", "kunden", "kpis", "suche"],
  finanz: ["finanzen", "kunden", "kpis", "suche"],
  fahrer: ["transporte", "fahrer", "fahrzeuge", "patienten", "suche"],
};

export function erlaubteBereiche(role: AppRole | null | undefined): Bereich[] {
  if (!role) return ["suche"];
  return ROLE_BEREICHE[role] ?? ["suche"];
}

export function darfBereich(role: AppRole | null | undefined, bereich: Bereich): boolean {
  return erlaubteBereiche(role).includes(bereich);
}

/** Höchste Rolle aus einer Liste (admin > disposition > finanz > fahrer). */
const RANG: Record<AppRole, number> = { admin: 0, disposition: 1, finanz: 2, fahrer: 3 };
export function hoechsteRolle(rollen: AppRole[]): AppRole | null {
  if (rollen.length === 0) return null;
  return [...rollen].sort((a, b) => RANG[a] - RANG[b])[0];
}

// ── Auftrags-Berechtigungen (spiegeln die RLS-Policies der orders-Tabelle) ──
// INSERT/DELETE: admin + disposition · UPDATE: admin + disposition + fahrer

/** Darf neue Aufträge anlegen oder bestehende vollständig bearbeiten? */
export function darfAuftragVerwalten(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "disposition";
}

/** Darf den Status eines Auftrags ändern (inkl. Fahrer für eigene Touren)? */
export function darfAuftragStatusAendern(role: AppRole | null | undefined): boolean {
  return role === "admin" || role === "disposition" || role === "fahrer";
}
