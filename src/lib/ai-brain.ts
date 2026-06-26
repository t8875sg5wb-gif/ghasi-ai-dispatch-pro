// ============================================================
// GHASI AI — Central AI Brain
// ------------------------------------------------------------
// One shared, intelligent data context for the whole platform.
// Aggregates every operational domain (drivers, vehicles, jobs,
// patients, customers, facilities, finance, maintenance) into a
// single deterministic snapshot and derives enterprise-grade
// intelligence on top of it:
//   - Executive KPIs & dynamic Business Health Score (0–100)
//   - Predictive forecasts (revenue, workload, fleet, staffing,
//     maintenance, fuel, seasonal demand)
//   - Autonomous optimisation insights (with reasons)
//   - Categorised smart alerts (Kritisch/Hoch/Mittel/Niedrig)
//
// The numeric core is intentionally deterministic (no Date.now in
// the seed maths) so SSR/hydration stays stable. Time-relative
// alerts reuse the existing rule engine and are computed on the
// client. Existing modules remain completely untouched.
// ============================================================
import { INITIAL_FAHRER, type Fahrer } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE, type Fahrzeug, fahrzeugWarnungen, reparaturkostenGesamt } from "@/lib/fahrzeuge";
import { INITIAL_AUFTRAEGE, type Auftrag } from "@/lib/auftraege";
import { KUNDEN, PATIENTEN } from "@/lib/stammdaten";
import { generateHinweise, type Hinweis, type HinweisStufe } from "@/lib/ghasi-hinweise";

export const EUR = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/* ------------------------------------------------------------------ *
 * Executive KPIs
 * ------------------------------------------------------------------ */

export interface BrainKpis {
  aktiveFahrzeuge: number;
  freieFahrzeuge: number;
  aktiveFahrer: number;
  freieFahrer: number;
  laufendeTransporte: number;
  offeneTransporte: number;
  patientenUnterwegs: number;
  umsatzHeute: number;
  umsatzMonat: number;
  gewinnHeute: number;
  gewinnMonat: number;
  margeProzent: number;
  offeneRechnungen: number;
  flottenauslastung: number; // %
  fahrerauslastung: number; // %
  wartungOffen: number;
  kritischeAlarme: number;
  aiEffizienz: number; // %
  durchschnittPuenktlichkeit: number; // %
  durchschnittBewertung: number; // 0–5
}

export function computeKpis(): BrainKpis {
  const fahrer = INITIAL_FAHRER;
  const fzg = INITIAL_FAHRZEUGE;
  const auftraege = INITIAL_AUFTRAEGE;

  const aktiveFahrzeuge = fzg.filter((v) => v.status === "unterwegs").length;
  const freieFahrzeuge = fzg.filter((v) => v.status === "frei").length;
  const aktiveFahrer = fahrer.filter((f) => f.status === "unterwegs").length;
  const freieFahrer = fahrer.filter((f) => f.status === "verfuegbar").length;

  const laufendeTransporte = auftraege.filter((a) => a.status === "unterwegs").length;
  const offeneTransporte = auftraege.filter((a) => a.status === "neu" || a.status === "disponiert").length;
  const patientenUnterwegs = laufendeTransporte;

  const umsatzHeute = fahrer.reduce((s, f) => s + f.umsatzHeute, 0);
  const gewinnHeute = fahrer.reduce((s, f) => s + f.gewinnHeute, 0);
  const umsatzMonat = fzg.reduce((s, v) => s + v.monatsumsatz, 0);
  const gewinnMonat = fzg.reduce((s, v) => s + v.monatsgewinn, 0);
  const margeProzent = umsatzMonat > 0 ? round((gewinnMonat / umsatzMonat) * 100) : 0;

  const offeneRechnungen = KUNDEN.reduce((s, k) => s + k.offeneRechnungen, 0);

  const einsetzbareFzg = fzg.filter((v) => v.status !== "werkstatt" && v.status !== "nicht_verfuegbar").length;
  const flottenauslastung = einsetzbareFzg > 0 ? round((aktiveFahrzeuge / einsetzbareFzg) * 100) : 0;
  const dienstfahrer = fahrer.filter((f) => f.status !== "urlaub" && f.status !== "krank" && f.status !== "feierabend").length;
  const fahrerauslastung = dienstfahrer > 0 ? round((aktiveFahrer / dienstfahrer) * 100) : 0;

  const wartungOffen = fzg.filter((v) => v.status === "werkstatt" || fahrzeugWarnungen(v).hatWarnung).length;
  const kritischeAlarme = fzg.filter((v) => {
    const w = fahrzeugWarnungen(v);
    return w.tuev || w.versicherung || w.wartung;
  }).length;

  const durchschnittPuenktlichkeit = round(fahrer.reduce((s, f) => s + f.puenktlichkeit, 0) / fahrer.length);
  const durchschnittBewertung = round(fahrer.reduce((s, f) => s + f.bewertung, 0) / fahrer.length, 1);

  // AI efficiency: blend of utilisation balance, punctuality and margin.
  const aiEffizienz = round(
    0.4 * ((flottenauslastung + fahrerauslastung) / 2) +
      0.35 * durchschnittPuenktlichkeit +
      0.25 * Math.min(100, margeProzent * 3),
  );

  return {
    aktiveFahrzeuge,
    freieFahrzeuge,
    aktiveFahrer,
    freieFahrer,
    laufendeTransporte,
    offeneTransporte,
    patientenUnterwegs,
    umsatzHeute,
    umsatzMonat,
    gewinnHeute,
    gewinnMonat,
    margeProzent,
    offeneRechnungen,
    flottenauslastung,
    fahrerauslastung,
    wartungOffen,
    kritischeAlarme,
    aiEffizienz,
    durchschnittPuenktlichkeit,
    durchschnittBewertung,
  };
}

/* ------------------------------------------------------------------ *
 * Business Health Score (0–100)
 * ------------------------------------------------------------------ */

export type HealthStufe = "exzellent" | "gut" | "stabil" | "kritisch";

export interface HealthFaktor {
  label: string;
  wert: number; // 0–100 contribution (already weighted to its max)
  max: number;
  beschreibung: string;
}

export interface BusinessHealth {
  score: number;
  stufe: HealthStufe;
  faktoren: HealthFaktor[];
}

export function computeBusinessHealth(kpis: BrainKpis = computeKpis()): BusinessHealth {
  // Five weighted pillars sum to 100.
  const profitabilitaet = Math.min(20, round((kpis.margeProzent / 30) * 20)); // 30 % margin = full
  const auslastung = round(((kpis.flottenauslastung + kpis.fahrerauslastung) / 2 / 100) * 25);
  const puenktlichkeit = round((kpis.durchschnittPuenktlichkeit / 100) * 20);
  const zufriedenheit = round((kpis.durchschnittBewertung / 5) * 15);
  const risiko = Math.max(0, 20 - kpis.kritischeAlarme * 4 - kpis.wartungOffen * 1.5); // fewer issues = better

  const faktoren: HealthFaktor[] = [
    { label: "Profitabilität", wert: profitabilitaet, max: 20, beschreibung: `Marge ${kpis.margeProzent} %` },
    { label: "Auslastung", wert: auslastung, max: 25, beschreibung: `Flotte ${kpis.flottenauslastung} % · Fahrer ${kpis.fahrerauslastung} %` },
    { label: "Pünktlichkeit", wert: puenktlichkeit, max: 20, beschreibung: `Ø ${kpis.durchschnittPuenktlichkeit} %` },
    { label: "Kundenzufriedenheit", wert: zufriedenheit, max: 15, beschreibung: `Ø ${kpis.durchschnittBewertung}/5` },
    { label: "Risiko & Compliance", wert: round(risiko), max: 20, beschreibung: `${kpis.kritischeAlarme} kritisch · ${kpis.wartungOffen} Wartung offen` },
  ];

  const score = Math.max(0, Math.min(100, round(faktoren.reduce((s, f) => s + f.wert, 0))));
  const stufe: HealthStufe = score >= 85 ? "exzellent" : score >= 70 ? "gut" : score >= 55 ? "stabil" : "kritisch";

  return { score, stufe, faktoren };
}

/* ------------------------------------------------------------------ *
 * Predictive forecasts
 * ------------------------------------------------------------------ */

export interface ForecastPoint {
  label: string;
  ist?: number;
  prognose: number;
}

export interface Prognosen {
  umsatzWoche: ForecastPoint[];
  umsatzMonat: ForecastPoint[];
  auslastungWoche: ForecastPoint[];
  fahrerbedarf: ForecastPoint[];
  wartungsbedarf: ForecastPoint[];
  kraftstoff: ForecastPoint[];
  saisonNachfrage: ForecastPoint[];
  zusammenfassung: {
    umsatzWocheGesamt: number;
    erwarteterEngpassTag: string;
    fahrerLueckeSpitze: number;
    wartungenNaechste30Tage: number;
  };
}

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
// Deterministic weekday demand profile for NEMT (low weekend, dialysis-driven weekdays).
const TAGESPROFIL = [1.06, 1.12, 1.1, 1.08, 1.0, 0.62, 0.48];

export function computePrognosen(kpis: BrainKpis = computeKpis()): Prognosen {
  const basisUmsatz = kpis.umsatzHeute || 8000;

  const umsatzWoche: ForecastPoint[] = WOCHENTAGE.map((label, i) => ({
    label,
    ist: i < 2 ? round(basisUmsatz * TAGESPROFIL[i]) : undefined,
    prognose: round(basisUmsatz * TAGESPROFIL[i]),
  }));
  const umsatzWocheGesamt = umsatzWoche.reduce((s, p) => s + p.prognose, 0);

  const monatsBasis = kpis.umsatzMonat || basisUmsatz * 22;
  const umsatzMonat: ForecastPoint[] = ["KW 1", "KW 2", "KW 3", "KW 4"].map((label, i) => ({
    label,
    ist: i < 2 ? round((monatsBasis / 4) * (1 + i * 0.04)) : undefined,
    prognose: round((monatsBasis / 4) * (1 + i * 0.06)),
  }));

  const auslastungWoche: ForecastPoint[] = WOCHENTAGE.map((label, i) => ({
    label,
    prognose: Math.min(100, round(kpis.flottenauslastung * TAGESPROFIL[i] + 6)),
  }));

  // Drivers needed vs. on duty.
  const grundFahrer = INITIAL_FAHRER.filter((f) => f.status !== "urlaub" && f.status !== "krank").length;
  const fahrerbedarf: ForecastPoint[] = WOCHENTAGE.map((label, i) => ({
    label,
    ist: grundFahrer,
    prognose: round(grundFahrer * TAGESPROFIL[i] * 1.04),
  }));
  const fahrerLueckeSpitze = Math.max(
    0,
    ...fahrerbedarf.map((p) => round((p.prognose ?? 0) - (p.ist ?? 0))),
  );
  const engpassIdx = fahrerbedarf.reduce((best, p, i, arr) => (p.prognose > arr[best].prognose ? i : best), 0);

  // Maintenance load over the next weeks.
  const wartungsbedarf: ForecastPoint[] = ["KW 1", "KW 2", "KW 3", "KW 4"].map((label, i) => ({
    label,
    prognose: Math.max(0, round(kpis.wartungOffen * (i === 0 ? 1 : 0.6) + (i % 2))),
  }));
  const wartungenNaechste30Tage = wartungsbedarf.reduce((s, p) => s + p.prognose, 0);

  const tankBasis = INITIAL_FAHRZEUGE.reduce((s, v) => s + v.verbrauch * (v.kraftstoff === "Elektro" ? 0 : 1), 0);
  const kraftstoff: ForecastPoint[] = WOCHENTAGE.map((label, i) => ({
    label,
    prognose: round(tankBasis * TAGESPROFIL[i] * 1.5),
  }));

  const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun"];
  const SAISON = [1.08, 1.04, 1.0, 0.98, 0.95, 0.9]; // winter peak for NEMT
  const saisonNachfrage: ForecastPoint[] = MONATE.map((label, i) => ({
    label,
    prognose: round((monatsBasis / 1000) * SAISON[i]),
  }));

  return {
    umsatzWoche,
    umsatzMonat,
    auslastungWoche,
    fahrerbedarf,
    wartungsbedarf,
    kraftstoff,
    saisonNachfrage,
    zusammenfassung: {
      umsatzWocheGesamt,
      erwarteterEngpassTag: WOCHENTAGE[engpassIdx],
      fahrerLueckeSpitze,
      wartungenNaechste30Tage,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Autonomous optimisation insights (deterministic baseline)
 * ------------------------------------------------------------------ */

export type InsightKategorie =
  | "kosten"
  | "gewinn"
  | "auslastung"
  | "fahrer"
  | "flotte"
  | "planung"
  | "trend";

export type InsightWirkung = "hoch" | "mittel" | "niedrig";

export interface Insight {
  id: string;
  kategorie: InsightKategorie;
  titel: string;
  erklaerung: string; // WHY
  empfehlung: string;
  wirkung: InsightWirkung;
  potenzial?: string; // e.g. "+340 €/Woche"
  to: string;
}

export function computeInsights(): Insight[] {
  const insights: Insight[] = [];
  const kpis = computeKpis();

  // Underutilised vehicles: free + below-average monthly revenue.
  const avgFzgUmsatz = INITIAL_FAHRZEUGE.reduce((s, v) => s + v.monatsumsatz, 0) / INITIAL_FAHRZEUGE.length;
  const unterausgelastet = INITIAL_FAHRZEUGE.filter(
    (v) => v.status === "frei" && v.monatsumsatz < avgFzgUmsatz * 0.7,
  );
  for (const v of unterausgelastet.slice(0, 2)) {
    insights.push({
      id: `flotte-${v.id}`,
      kategorie: "flotte",
      titel: `${v.kennzeichen} ist unterausgelastet`,
      erklaerung: `Monatsumsatz ${EUR(v.monatsumsatz)} liegt ${round((1 - v.monatsumsatz / avgFzgUmsatz) * 100)} % unter dem Flottendurchschnitt von ${EUR(avgFzgUmsatz)}.`,
      empfehlung: "Mehr Sitzend-/Dialysefahrten auf dieses Fahrzeug verteilen oder Standzeit reduzieren.",
      wirkung: "mittel",
      potenzial: `+${EUR(round(avgFzgUmsatz - v.monatsumsatz))}/Monat möglich`,
      to: "/fahrzeuge",
    });
  }

  // Overloaded drivers: high overtime.
  const ueberlastet = [...INITIAL_FAHRER].filter((f) => f.ueberstunden >= 25).sort((a, b) => b.ueberstunden - a.ueberstunden);
  for (const f of ueberlastet.slice(0, 2)) {
    insights.push({
      id: `fahrer-${f.id}`,
      kategorie: "fahrer",
      titel: `${f.name} ist überlastet`,
      erklaerung: `${f.ueberstunden} Überstunden im Monat – Risiko für Ausfälle, Unzufriedenheit und sinkende Pünktlichkeit (${f.puenktlichkeit} %).`,
      empfehlung: "Touren auf verfügbare Fahrer umverteilen und Ausgleichsschicht einplanen.",
      wirkung: "hoch",
      to: "/fahrer",
    });
  }

  // Empty mileage optimisation.
  const leerKm = round(INITIAL_FAHRER.reduce((s, f) => s + f.kmHeute, 0) * 0.18);
  if (leerKm > 50) {
    insights.push({
      id: "leerkilometer",
      kategorie: "kosten",
      titel: "Leerkilometer senken",
      erklaerung: `Geschätzt ${leerKm} km Leerfahrt heute. Kompatible Touren lassen sich durch Sammelfahrten bündeln.`,
      empfehlung: "Dispatch-Center: kompatible Dialyse-Rückfahrten zusammenlegen.",
      wirkung: "hoch",
      potenzial: `+${EUR(round(leerKm * 0.9))}/Tag Ersparnis`,
      to: "/tourenplanung",
    });
  }

  // Open invoices → cash flow.
  if (kpis.offeneRechnungen > 0) {
    insights.push({
      id: "offene-rechnungen",
      kategorie: "gewinn",
      titel: `${kpis.offeneRechnungen} offene Rechnungen`,
      erklaerung: "Offene Posten binden Liquidität. Frühzeitige Mahnungen verbessern den Cashflow.",
      empfehlung: "GHASI AI Mahnungs-Entwürfe vorbereiten lassen (Versand nur nach Freigabe).",
      wirkung: "mittel",
      to: "/rechnungen",
    });
  }

  // Utilisation headroom.
  if (kpis.flottenauslastung < 70 && kpis.offeneTransporte > 0) {
    insights.push({
      id: "auslastung",
      kategorie: "auslastung",
      titel: "Freie Kapazität nutzen",
      erklaerung: `Flottenauslastung ${kpis.flottenauslastung} % bei ${kpis.offeneTransporte} offenen Transporten – freie Fahrzeuge können sofort disponiert werden.`,
      empfehlung: "Auto-Dispatch im Dispatch-Center starten.",
      wirkung: "hoch",
      to: "/tourenplanung",
    });
  }

  // Recurring patients trend.
  const wiederkehrend = PATIENTEN.filter((p) => /dialyse|3×|regelm/i.test(p.hinweis)).length;
  if (wiederkehrend > 0) {
    insights.push({
      id: "wiederkehrend",
      kategorie: "trend",
      titel: `${wiederkehrend} wiederkehrende Patienten`,
      erklaerung: "Regelmäßige Dialyse-/Therapiefahrten lassen sich als Serientermine fest einplanen und sichern planbaren Umsatz.",
      empfehlung: "Serientouren anlegen und feste Fahrer/Fahrzeuge zuordnen.",
      wirkung: "mittel",
      to: "/dialysezentren",
    });
  }

  // Maintenance cost watch.
  const teuersteReparatur = [...INITIAL_FAHRZEUGE].sort((a, b) => reparaturkostenGesamt(b) - reparaturkostenGesamt(a))[0];
  if (teuersteReparatur && reparaturkostenGesamt(teuersteReparatur) > 800) {
    insights.push({
      id: `wartungskosten-${teuersteReparatur.id}`,
      kategorie: "kosten",
      titel: `Hohe Reparaturkosten: ${teuersteReparatur.kennzeichen}`,
      erklaerung: `Reparaturen summieren sich auf ${EUR(reparaturkostenGesamt(teuersteReparatur))}. Bei weiter steigenden Kosten Ersatz prüfen.`,
      empfehlung: "Wirtschaftlichkeit Reparatur vs. Leasingwechsel bewerten.",
      wirkung: "mittel",
      to: "/wartung",
    });
  }

  const rang: Record<InsightWirkung, number> = { hoch: 0, mittel: 1, niedrig: 2 };
  return insights.sort((a, b) => rang[a.wirkung] - rang[b.wirkung]);
}

/* ------------------------------------------------------------------ *
 * Smart Alert Center
 * ------------------------------------------------------------------ */

export type AlarmPrioritaet = "Kritisch" | "Hoch" | "Mittel" | "Niedrig";

export interface Alarm extends Hinweis {
  prioritaet: AlarmPrioritaet;
}

const STUFE_PRIO: Record<HinweisStufe, AlarmPrioritaet> = {
  kritisch: "Kritisch",
  warnung: "Hoch",
  info: "Mittel",
  positiv: "Niedrig",
};

export const ALARM_PRIO_META: Record<AlarmPrioritaet, { dot: string; badge: string; ring: string }> = {
  Kritisch: { dot: "bg-destructive", badge: "border-destructive/30 bg-destructive/10 text-destructive", ring: "bg-destructive/15 text-destructive" },
  Hoch: { dot: "bg-warning", badge: "border-warning/30 bg-warning/10 text-warning", ring: "bg-warning/20 text-warning" },
  Mittel: { dot: "bg-info", badge: "border-info/30 bg-info/10 text-info", ring: "bg-info/15 text-info" },
  Niedrig: { dot: "bg-success", badge: "border-success/30 bg-success/10 text-success", ring: "bg-success/15 text-success" },
};

/** Reuses the rule engine and re-categorises into 4 priority levels. Client-only (time-relative). */
export function computeAlarme(): Alarm[] {
  return generateHinweise().map((h) => ({ ...h, prioritaet: STUFE_PRIO[h.stufe] }));
}

/* ------------------------------------------------------------------ *
 * Compact text snapshot for the AI (server + client safe)
 * ------------------------------------------------------------------ */

export function buildBrainSnapshot(): string {
  const k = computeKpis();
  const h = computeBusinessHealth(k);
  const lines: string[] = [];
  lines.push("# GHASI AI – Live Unternehmenskontext");
  lines.push(
    `Business Health Score: ${h.score}/100 (${h.stufe}). ` +
      `Umsatz heute ${EUR(k.umsatzHeute)}, Gewinn heute ${EUR(k.gewinnHeute)}, Marge ${k.margeProzent} %.`,
  );
  lines.push(
    `Flotte: ${k.aktiveFahrzeuge} aktiv / ${k.freieFahrzeuge} frei, Auslastung ${k.flottenauslastung} %. ` +
      `Fahrer: ${k.aktiveFahrer} unterwegs / ${k.freieFahrer} frei, Auslastung ${k.fahrerauslastung} %.`,
  );
  lines.push(
    `Transporte: ${k.laufendeTransporte} laufend, ${k.offeneTransporte} offen. ` +
      `Offene Rechnungen: ${k.offeneRechnungen}. Wartung offen: ${k.wartungOffen}. Kritische Alarme: ${k.kritischeAlarme}.`,
  );
  return lines.join("\n");
}

export type { Fahrer, Fahrzeug, Auftrag };
