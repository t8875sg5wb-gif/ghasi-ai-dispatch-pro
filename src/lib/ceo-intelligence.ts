// ============================================================
// GHASI AI — Digital CEO Intelligence
// ------------------------------------------------------------
// The autonomous "managing director" brain on top of the AI Brain.
// It continuously derives CEO-grade intelligence from the live
// operational + financial data:
//   - Cashflow / revenue / profit forecasts (7 / 30 / 90 / 365 days)
//   - Profit per order, driver, vehicle and customer
//   - Unprofitable customers & vehicles detection
//   - Empty-mileage detection + savings potential
//   - Automatic ride-combination suggestions (with km/€ saved)
//   - Open capacity ("we can accept X more orders today")
//   - Driver performance & efficiency ranking
//   - Business risk alerts (with € impact)
//   - Ranked CEO recommendations (WHY + € impact)
//   - Morning CEO briefing + evening performance summary (narrative)
//
// Every number is deterministic (SSR/hydration safe). The layer is
// advisory only — GHASI AI recommends, it never executes or sends.
// ============================================================
import { INITIAL_FAHRER, type Fahrer } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE, reparaturkostenGesamt, type Fahrzeug } from "@/lib/fahrzeuge";
import { INITIAL_AUFTRAEGE, type Auftrag, type Transportart } from "@/lib/auftraege";
import { KUNDEN } from "@/lib/stammdaten";
import { computeFinanzKpis, computeKostenaufstellung } from "@/lib/finance";
import { computeKpis, computeBusinessHealth, EUR, type BrainKpis } from "@/lib/ai-brain";

const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

/** Deterministic pseudo distance (km) for an order from its id — stable across renders. */
function seedKm(id: string, avg: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 1000;
  return round(avg * (0.6 + (h / 1000) * 0.9), 1); // 60 %–150 % of the average
}

/** Average blended cost per driven km (fuel + running + wear), used for order margins. */
const KOSTEN_PRO_KM = 0.85;

/** Tariff model per transport type (base fare + per-km + typical distance). */
const TARIF: Record<Transportart, { grund: number; proKm: number; avgKm: number }> = {
  Liegendtransport: { grund: 60, proKm: 2.4, avgKm: 18 },
  Sitzendtransport: { grund: 25, proKm: 1.3, avgKm: 12 },
  Rollstuhl: { grund: 35, proKm: 1.6, avgKm: 14 },
  Dialysefahrt: { grund: 30, proKm: 1.4, avgKm: 16 },
  Notfall: { grund: 90, proKm: 3.0, avgKm: 20 },
};

const AKTIVE_STATUS: Auftrag["status"][] = ["neu", "disponiert", "unterwegs"];

/* ------------------------------------------------------------------ *
 * Cashflow & profit forecast (7 / 30 / 90 / 365 days)
 * ------------------------------------------------------------------ */

export interface HorizonForecast {
  tage: number;
  label: string;
  umsatz: number;
  ausgaben: number;
  gewinn: number;
  cashflow: number;
}

export function computeCashflowForecast(kpis: BrainKpis = computeKpis()): HorizonForecast[] {
  const fin = computeFinanzKpis();
  const tagesUmsatz = kpis.umsatzHeute || round(fin.umsatzMonat / 22) || 8000;
  const tagesAusgaben = round((fin.ausgabenMonat || tagesUmsatz * 0.72) / 30);
  // Slight seasonal growth for NEMT (winter/dialysis-driven demand).
  const wachstum = 0.015; // ~1.5 % per 30-day block

  const horizonte = [
    { tage: 7, label: "7 Tage" },
    { tage: 30, label: "30 Tage" },
    { tage: 90, label: "90 Tage" },
    { tage: 365, label: "1 Jahr" },
  ];

  return horizonte.map(({ tage, label }) => {
    const bloecke = tage / 30;
    const faktor = 1 + wachstum * bloecke;
    const umsatz = round(tagesUmsatz * tage * faktor);
    const ausgaben = round(tagesAusgaben * tage);
    const gewinn = umsatz - ausgaben;
    // Cashflow lags revenue by the outstanding receivables that stay unpaid.
    const cashflowDrag = Math.min(umsatz * 0.5, fin.offenePosten);
    const cashflow = round(gewinn - cashflowDrag * (tage <= 30 ? 1 : 0.3));
    return { tage, label, umsatz, ausgaben, gewinn, cashflow };
  });
}

/* ------------------------------------------------------------------ *
 * Profit per order / driver / vehicle / customer
 * ------------------------------------------------------------------ */

export interface AuftragProfit {
  auftrag: Auftrag;
  km: number;
  umsatz: number;
  kosten: number;
  gewinn: number;
  marge: number;
  /** true = Umsatz aus TARIF geschätzt; false = aus verknüpfter Rechnung übernommen. */
  istSchaetzung: boolean;
}

export function profitProAuftrag(
  auftraege: Auftrag[] = INITIAL_AUFTRAEGE,
  rechnungen: Rechnung[] = INITIAL_RECHNUNGEN,
): AuftragProfit[] {
  // Index der Netto-Umsätze je verknüpftem Auftrag (echte Rechnungen).
  const rechnungUmsatz = new Map<string, number>();
  for (const r of rechnungen) {
    if (r.typ !== "rechnung" || !r.bezugAuftrag) continue;
    rechnungUmsatz.set(r.bezugAuftrag, (rechnungUmsatz.get(r.bezugAuftrag) ?? 0) + netto(r));
  }

  return auftraege
    .filter((a) => a.status !== "storniert")
    .map((a) => {
      const t = TARIF[a.transportart] ?? TARIF.Sitzendtransport;
      const km = seedKm(a.id, t.avgKm);
      const echterUmsatz = rechnungUmsatz.get(a.nummer);
      const istSchaetzung = echterUmsatz === undefined;
      const umsatz = istSchaetzung ? round(t.grund + km * t.proKm) : round(echterUmsatz);
      const kosten = round(km * KOSTEN_PRO_KM + t.grund * 0.25);
      const gewinn = round(umsatz - kosten);
      const marge = umsatz > 0 ? round((gewinn / umsatz) * 100) : 0;
      return { auftrag: a, km, umsatz, kosten, gewinn, marge, istSchaetzung };
    })
    .sort((a, b) => b.gewinn - a.gewinn);
}


export interface FahrerProfit {
  fahrer: Fahrer;
  umsatz: number;
  gewinn: number;
  km: number;
  gewinnProKm: number;
  effizienz: number; // 0–100 composite score
}

export function profitProFahrer(fahrer: Fahrer[] = INITIAL_FAHRER): FahrerProfit[] {
  const maxGpk = Math.max(1, ...fahrer.map((f) => (f.kmHeute > 0 ? f.gewinnHeute / f.kmHeute : 0)));
  return fahrer
    .map((f) => {
      const gewinnProKm = f.kmHeute > 0 ? round(f.gewinnHeute / f.kmHeute, 2) : 0;
      const effizienz = round(
        0.4 * (gewinnProKm / maxGpk) * 100 +
          0.35 * f.puenktlichkeit +
          0.25 * (f.bewertung / 5) * 100 -
          Math.min(15, f.ueberstunden * 0.3),
      );
      return {
        fahrer: f,
        umsatz: f.umsatzHeute,
        gewinn: f.gewinnHeute,
        km: f.kmHeute,
        gewinnProKm,
        effizienz: Math.max(0, Math.min(100, effizienz)),
      };
    })
    .sort((a, b) => b.effizienz - a.effizienz);
}

export interface FahrzeugProfit {
  fahrzeug: Fahrzeug;
  umsatz: number;
  gewinn: number;
  marge: number;
  reparaturkosten: number;
  wirtschaftlich: boolean;
}

export function profitProFahrzeug(fahrzeuge: Fahrzeug[] = INITIAL_FAHRZEUGE): FahrzeugProfit[] {
  return fahrzeuge
    .map((v) => {
      const marge = v.monatsumsatz > 0 ? round((v.monatsgewinn / v.monatsumsatz) * 100) : 0;
      const reparaturkosten = reparaturkostenGesamt(v);
      // Uneconomic when repairs eat >25 % of monthly profit or margin is very thin.
      const wirtschaftlich = marge >= 10 && reparaturkosten < Math.max(600, v.monatsgewinn * 0.25);
      return { fahrzeug: v, umsatz: v.monatsumsatz, gewinn: v.monatsgewinn, marge, reparaturkosten, wirtschaftlich };
    })
    .sort((a, b) => b.gewinn - a.gewinn);
}

export interface KundeProfit {
  name: string;
  typ: string;
  umsatzJahr: number;
  offeneRechnungen: number;
  anteilAuftraege: number;
  profitabel: boolean;
}

export function profitProKunde(auftraege: Auftrag[] = INITIAL_AUFTRAEGE): KundeProfit[] {
  const gesamtAuftraege = Math.max(1, auftraege.length);
  return KUNDEN.map((k) => {
    const anzahl = auftraege.filter((a) => a.kostentraeger?.includes(k.name)).length;
    const anteilAuftraege = round((anzahl / gesamtAuftraege) * 100);
    const umsatzJahr = k.umsatzJahr ?? 0;
    // Unprofitable: many open invoices relative to revenue, or almost no revenue.
    const profitabel = umsatzJahr > 20000 && k.offeneRechnungen <= 2;
    return {
      name: k.name,
      typ: k.typ,
      umsatzJahr,
      offeneRechnungen: k.offeneRechnungen,
      anteilAuftraege,
      profitabel,
    };
  }).sort((a, b) => b.umsatzJahr - a.umsatzJahr);
}

/* ------------------------------------------------------------------ *
 * Empty mileage & ride-combination optimisation
 * ------------------------------------------------------------------ */

export interface EmptyMileage {
  leerKm: number;
  anteilProzent: number;
  ersparnisTag: number;
  ersparnisMonat: number;
}

export function computeEmptyMileage(fahrer: Fahrer[] = INITIAL_FAHRER): EmptyMileage {
  const gesamtKm = fahrer.reduce((s, f) => s + f.kmHeute, 0);
  const leerKm = round(gesamtKm * 0.18);
  const anteilProzent = gesamtKm > 0 ? round((leerKm / gesamtKm) * 100) : 0;
  const ersparnisTag = round(leerKm * 0.9);
  return { leerKm, anteilProzent, ersparnisTag, ersparnisMonat: ersparnisTag * 22 };
}

export interface Kombivorschlag {
  a: Auftrag;
  b: Auftrag;
  grund: string;
  kmGespart: number;
  ersparnis: number;
}

function ortKey(a: Auftrag): string {
  const ziel = a.destination?.city ?? a.zielort ?? "";
  return ziel.toLowerCase().split(/[\s,]/)[0] ?? "";
}

export function suggestOrderCombinations(auftraege: Auftrag[] = INITIAL_AUFTRAEGE): Kombivorschlag[] {
  const aktiv = auftraege.filter((a) => AKTIVE_STATUS.includes(a.status));
  const vorschlaege: Kombivorschlag[] = [];
  for (let i = 0; i < aktiv.length; i++) {
    for (let j = i + 1; j < aktiv.length; j++) {
      const a = aktiv[i];
      const b = aktiv[j];
      const gleicherOrt = ortKey(a) && ortKey(a) === ortKey(b);
      const gleicheKasse = a.kostentraeger && a.kostentraeger === b.kostentraeger;
      const gleicheArt = a.transportart === b.transportart;
      const nahAmTermin =
        Math.abs(new Date(a.termin).getTime() - new Date(b.termin).getTime()) <= 90 * 60_000;
      if ((gleicherOrt || (gleicheKasse && gleicheArt)) && nahAmTermin) {
        const t = TARIF[a.transportart] ?? TARIF.Sitzendtransport;
        const kmGespart = round(seedKm(b.id, t.avgKm) * 0.55, 1);
        const ersparnis = round(kmGespart * (KOSTEN_PRO_KM + 0.35));
        vorschlaege.push({
          a,
          b,
          grund: gleicherOrt
            ? `Gleiches Zielgebiet (${ortKey(a)}) und Termine < 90 Min auseinander`
            : `Gleicher Kostenträger & Transportart, Termine < 90 Min auseinander`,
          kmGespart,
          ersparnis,
        });
      }
    }
  }
  return vorschlaege.sort((x, y) => y.kmGespart - x.kmGespart).slice(0, 6);
}

/* ------------------------------------------------------------------ *
 * Open capacity — "how many more orders can we accept today?"
 * ------------------------------------------------------------------ */

export interface Kapazitaet {
  freieFahrer: number;
  freieFahrzeuge: number;
  freieSlots: number;
  zusaetzlicheAuftraege: number;
  potenzialUmsatz: number;
}

export function computeCapacity(kpis: BrainKpis = computeKpis()): Kapazitaet {
  const freieSlots = Math.min(kpis.freieFahrer, kpis.freieFahrzeuge);
  // Assume ~3 further transports per free driver/vehicle pair for the rest of the day.
  const zusaetzlicheAuftraege = Math.max(0, freieSlots * 3 - kpis.offeneTransporte);
  const potenzialUmsatz = round(zusaetzlicheAuftraege * 42); // avg fare per ride
  return {
    freieFahrer: kpis.freieFahrer,
    freieFahrzeuge: kpis.freieFahrzeuge,
    freieSlots,
    zusaetzlicheAuftraege,
    potenzialUmsatz,
  };
}

/* ------------------------------------------------------------------ *
 * CEO recommendations (ranked, WHY + € impact) & risk alerts
 * ------------------------------------------------------------------ */

export type CeoWirkung = "hoch" | "mittel" | "niedrig";

export interface CeoRecommendation {
  id: string;
  titel: string;
  warum: string;
  impact: string;
  wirkung: CeoWirkung;
  to: string;
}

export function computeCeoRecommendations(
  auftraege: Auftrag[] = INITIAL_AUFTRAEGE,
): CeoRecommendation[] {
  const kpis = computeKpis();
  const recs: CeoRecommendation[] = [];

  const empty = computeEmptyMileage();
  if (empty.leerKm > 40) {
    recs.push({
      id: "leerkm",
      titel: `Leerkilometer senken (${empty.anteilProzent} %)`,
      warum: `Heute rund ${empty.leerKm} km Leerfahrt. Kompatible Dialyse-Rückfahrten lassen sich bündeln.`,
      impact: `+${EUR(empty.ersparnisTag)}/Tag · ${EUR(empty.ersparnisMonat)}/Monat`,
      wirkung: "hoch",
      to: "/tourenplanung",
    });
  }

  const combos = suggestOrderCombinations(auftraege);
  if (combos.length > 0) {
    const km = combos.reduce((s, c) => s + c.kmGespart, 0);
    const eur = combos.reduce((s, c) => s + c.ersparnis, 0);
    recs.push({
      id: "kombi",
      titel: `${combos.length} Fahrten kombinierbar`,
      warum: `Sammelfahrten mit gleichem Zielgebiet/Kostenträger sparen ${round(km)} km.`,
      impact: `+${EUR(eur)} sofort`,
      wirkung: "hoch",
      to: "/tourenplanung",
    });
  }

  const cap = computeCapacity(kpis);
  if (cap.zusaetzlicheAuftraege > 0) {
    recs.push({
      id: "kapazitaet",
      titel: `${cap.zusaetzlicheAuftraege} weitere Aufträge möglich`,
      warum: `${cap.freieFahrer} freie Fahrer und ${cap.freieFahrzeuge} freie Fahrzeuge sind noch nicht ausgelastet.`,
      impact: `+${EUR(cap.potenzialUmsatz)} Umsatzpotenzial`,
      wirkung: "mittel",
      to: "/auftraege",
    });
  }

  const fin = computeFinanzKpis();
  if (fin.ueberfaelligeSumme > 0) {
    recs.push({
      id: "mahnung",
      titel: `${fin.anzahlUeberfaellig} überfällige Rechnungen`,
      warum: `${EUR(fin.ueberfaelligeSumme)} sind überfällig und binden Liquidität.`,
      impact: `+${EUR(fin.ueberfaelligeSumme)} Cashflow`,
      wirkung: "hoch",
      to: "/rechnungen",
    });
  }

  const teuerstes = [...INITIAL_FAHRZEUGE].sort(
    (a, b) => reparaturkostenGesamt(b) - reparaturkostenGesamt(a),
  )[0];
  if (teuerstes && reparaturkostenGesamt(teuerstes) > 800) {
    recs.push({
      id: `ersatz-${teuerstes.id}`,
      titel: `Ersatz für ${teuerstes.kennzeichen} prüfen`,
      warum: `Reparaturkosten von ${EUR(reparaturkostenGesamt(teuerstes))} übersteigen die Wirtschaftlichkeit.`,
      impact: "Kostenrisiko senken",
      wirkung: "mittel",
      to: "/wartung",
    });
  }

  const ueberlastet = INITIAL_FAHRER.filter((f) => f.ueberstunden >= 25);
  if (ueberlastet.length > 0) {
    recs.push({
      id: "ueberstunden",
      titel: `${ueberlastet.length} Fahrer überlastet`,
      warum: `Hohe Überstunden (${ueberlastet[0].name}: ${ueberlastet[0].ueberstunden} h) erhöhen Ausfallrisiko & Kosten.`,
      impact: "Krankheits-/Fluktuationskosten vermeiden",
      wirkung: "mittel",
      to: "/fahrer",
    });
  }

  const rang: Record<CeoWirkung, number> = { hoch: 0, mittel: 1, niedrig: 2 };
  return recs.sort((a, b) => rang[a.wirkung] - rang[b.wirkung]);
}

export type RisikoStufe = "kritisch" | "hoch" | "mittel";

export interface RisikoAlert {
  id: string;
  titel: string;
  detail: string;
  impact: string;
  stufe: RisikoStufe;
  to: string;
}

export function computeRiskAlerts(): RisikoAlert[] {
  const kpis = computeKpis();
  const fin = computeFinanzKpis();
  const alerts: RisikoAlert[] = [];

  if (fin.margeProzent < 12) {
    alerts.push({
      id: "marge",
      titel: "Niedrige Gewinnmarge",
      detail: `Die Marge liegt bei ${fin.margeProzent} % – unter dem gesunden Zielwert von 15 %.`,
      impact: `Ziel: +${EUR(round((fin.umsatzMonat * 0.03)))}/Monat`,
      stufe: fin.margeProzent < 8 ? "kritisch" : "hoch",
      to: "/buchhaltung",
    });
  }

  if (fin.ueberfaelligeSumme > 0) {
    alerts.push({
      id: "cashflow",
      titel: "Liquiditätsrisiko",
      detail: `${EUR(fin.ueberfaelligeSumme)} überfällig (${fin.anzahlUeberfaellig} Rechnungen).`,
      impact: `${EUR(fin.ueberfaelligeSumme)} gebunden`,
      stufe: fin.ueberfaelligeSumme > fin.umsatzMonat * 0.1 ? "hoch" : "mittel",
      to: "/rechnungen",
    });
  }

  if (kpis.kritischeAlarme > 0) {
    alerts.push({
      id: "compliance",
      titel: "Compliance-Fristen",
      detail: `${kpis.kritischeAlarme} Fahrzeuge mit ablaufendem TÜV/Versicherung/Wartung.`,
      impact: "Betriebsausfall vermeiden",
      stufe: "kritisch",
      to: "/warnungen",
    });
  }

  if (kpis.flottenauslastung < 60) {
    alerts.push({
      id: "auslastung",
      titel: "Unterauslastung der Flotte",
      detail: `Flottenauslastung nur ${kpis.flottenauslastung} % – Fixkosten laufen ungenutzt weiter.`,
      impact: "Umsatzpotenzial ungenutzt",
      stufe: "mittel",
      to: "/tourenplanung",
    });
  }

  const rang: Record<RisikoStufe, number> = { kritisch: 0, hoch: 1, mittel: 2 };
  return alerts.sort((a, b) => rang[a.stufe] - rang[b.stufe]);
}

/* ------------------------------------------------------------------ *
 * Narrative CEO briefings (morning + evening)
 * ------------------------------------------------------------------ */

export function buildCeoBriefing(auftraege: Auftrag[] = INITIAL_AUFTRAEGE): string[] {
  const kpis = computeKpis();
  const cap = computeCapacity(kpis);
  const empty = computeEmptyMileage();
  const combos = suggestOrderCombinations(auftraege);
  const recs = computeCeoRecommendations(auftraege);
  const health = computeBusinessHealth(kpis);

  const zeilen: string[] = [];
  zeilen.push(
    `Guten Morgen. Der Business Health Score liegt bei ${health.score}/100 (${health.stufe}). ` +
      `Für heute erwarte ich rund ${EUR(kpis.umsatzHeute)} Umsatz und ${EUR(kpis.gewinnHeute)} Gewinn.`,
  );
  if (cap.zusaetzlicheAuftraege > 0) {
    zeilen.push(
      `Wir können heute noch ${cap.zusaetzlicheAuftraege} weitere Aufträge annehmen ` +
        `(${cap.freieFahrer} Fahrer, ${cap.freieFahrzeuge} Fahrzeuge frei) – Potenzial +${EUR(cap.potenzialUmsatz)}.`,
    );
  }
  if (empty.leerKm > 40) {
    zeilen.push(
      `Achtung Leerkilometer: ~${empty.leerKm} km (${empty.anteilProzent} %). ` +
        `Bündeln spart ${EUR(empty.ersparnisTag)}/Tag.`,
    );
  }
  if (combos[0]) {
    zeilen.push(
      `Empfehlung: ${combos[0].a.nummer} und ${combos[0].b.nummer} kombinieren – spart ${combos[0].kmGespart} km (${EUR(combos[0].ersparnis)}).`,
    );
  }
  if (recs[0]) zeilen.push(`Wichtigste Maßnahme: ${recs[0].titel} → ${recs[0].impact}.`);
  return zeilen;
}

export function buildEveningSummary(auftraege: Auftrag[] = INITIAL_AUFTRAEGE): string[] {
  const kpis = computeKpis();
  const fin = computeFinanzKpis();
  const topFahrer = profitProFahrer()[0];
  const empty = computeEmptyMileage();
  const abgeschlossen = auftraege.filter((a) => a.status === "abgeschlossen").length;

  const zeilen: string[] = [];
  zeilen.push(
    `Tagesabschluss: ${abgeschlossen} Transporte abgeschlossen, ` +
      `Umsatz ${EUR(kpis.umsatzHeute)}, Gewinn ${EUR(kpis.gewinnHeute)} (Marge ${fin.margeProzent} %).`,
  );
  if (topFahrer) {
    zeilen.push(
      `Beste Effizienz heute: ${topFahrer.fahrer.name} (${topFahrer.effizienz}/100, ${EUR(topFahrer.gewinn)} Gewinn).`,
    );
  }
  zeilen.push(
    `Leerkilometer lagen bei ${empty.anteilProzent} % – ${empty.anteilProzent > 15 ? "morgen durch bessere Bündelung senken" : "im guten Bereich"}.`,
  );
  if (fin.anzahlUeberfaellig > 0) {
    zeilen.push(
      `Offen: ${fin.anzahlUeberfaellig} überfällige Rechnungen (${EUR(fin.ueberfaelligeSumme)}) – morgen Mahnläufe freigeben.`,
    );
  }
  return zeilen;
}

/* ------------------------------------------------------------------ *
 * Compact CEO snapshot for the AI assistant context
 * ------------------------------------------------------------------ */

export function buildCeoSnapshot(): string {
  const cashflow = computeCashflowForecast();
  const cap = computeCapacity();
  const empty = computeEmptyMileage();
  const recs = computeCeoRecommendations();
  const risks = computeRiskAlerts();
  const topFahrer = profitProFahrer().slice(0, 3);

  const lines: string[] = [];
  lines.push("# Digital-CEO Intelligenz");
  lines.push(
    "Cashflow-Prognose: " +
      cashflow.map((c) => `${c.label} Gewinn ${EUR(c.gewinn)} / Cashflow ${EUR(c.cashflow)}`).join(" · "),
  );
  lines.push(
    `Freie Kapazität: ${cap.zusaetzlicheAuftraege} weitere Aufträge möglich (Potenzial ${EUR(cap.potenzialUmsatz)}). ` +
      `Leerkilometer: ${empty.leerKm} km (${empty.anteilProzent} %), Sparpotenzial ${EUR(empty.ersparnisTag)}/Tag.`,
  );
  if (topFahrer.length) {
    lines.push(
      "Top-Fahrer (Effizienz): " +
        topFahrer.map((f) => `${f.fahrer.name} ${f.effizienz}/100`).join(", ") + ".",
    );
  }
  if (recs.length) {
    lines.push("Wichtigste CEO-Empfehlungen:");
    for (const r of recs.slice(0, 5)) lines.push(`- ${r.titel} — ${r.warum} (${r.impact})`);
  }
  if (risks.length) {
    lines.push("Geschäftsrisiken:");
    for (const r of risks.slice(0, 4)) lines.push(`- [${r.stufe}] ${r.titel}: ${r.detail} (${r.impact})`);
  }
  return lines.join("\n");
}
