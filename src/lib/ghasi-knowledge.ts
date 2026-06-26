// GHASI AI Wissensschicht: verdichtet alle Unternehmensdaten zu einem
// kompakten Snapshot (für die KI) und einem Suchindex (für die globale Suche).
import { INITIAL_FAHRER } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";
import { INITIAL_AUFTRAEGE, STATUS_META, formatTermin } from "@/lib/auftraege";
import {
  KUNDEN,
  PATIENTEN,
  KRANKENHAEUSER,
  DIALYSEZENTREN,
  PFLEGEHEIME,
  KRANKENKASSEN,
} from "@/lib/stammdaten";

const EUR = (n: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export interface SearchItem {
  id: string;
  bereich: string;
  to: string;
  titel: string;
  untertitel: string;
  schlagworte: string;
}

export function buildSearchIndex(): SearchItem[] {
  const items: SearchItem[] = [];

  for (const a of INITIAL_AUFTRAEGE) {
    items.push({
      id: a.id,
      bereich: "Aufträge",
      to: "/auftraege",
      titel: `${a.nummer} · ${a.patient}`,
      untertitel: `${a.transportart} · ${STATUS_META[a.status].label}`,
      schlagworte: `${a.nummer} ${a.patient} ${a.abholort} ${a.zielort} ${a.kostentraeger}`,
    });
  }
  for (const f of INITIAL_FAHRER) {
    items.push({
      id: f.id,
      bereich: "Fahrer",
      to: "/fahrer",
      titel: f.name,
      untertitel: `${f.nummer} · ${f.telefon}`,
      schlagworte: `${f.name} ${f.nummer} ${f.email} ${f.fahrzeug ?? ""}`,
    });
  }
  for (const v of INITIAL_FAHRZEUGE) {
    items.push({
      id: v.id,
      bereich: "Fahrzeuge",
      to: "/fahrzeuge",
      titel: `${v.kennzeichen} · ${v.marke} ${v.modell}`,
      untertitel: `${v.typ} · ${v.nummer}`,
      schlagworte: `${v.kennzeichen} ${v.marke} ${v.modell} ${v.typ} ${v.fahrer ?? ""}`,
    });
  }
  for (const p of PATIENTEN) {
    items.push({
      id: p.id,
      bereich: "Patienten",
      to: "/patienten",
      titel: p.name,
      untertitel: `${p.mobilitaet} · ${p.kostentraeger}`,
      schlagworte: `${p.name} ${p.mobilitaet} ${p.kostentraeger} ${p.hinweis}`,
    });
  }
  for (const k of KUNDEN) {
    items.push({
      id: k.id,
      bereich: "Kunden",
      to: "/kunden",
      titel: k.name,
      untertitel: `${k.typ} · ${k.ansprechpartner}`,
      schlagworte: `${k.name} ${k.typ} ${k.ansprechpartner} ${k.telefon}`,
    });
  }
  const einrichtungen = [
    ...KRANKENHAEUSER.map((e) => ({ e, bereich: "Krankenhäuser", to: "/krankenhaeuser" })),
    ...DIALYSEZENTREN.map((e) => ({ e, bereich: "Dialysezentren", to: "/dialysezentren" })),
    ...PFLEGEHEIME.map((e) => ({ e, bereich: "Pflegeheime", to: "/pflegeheime" })),
  ];
  for (const { e, bereich, to } of einrichtungen) {
    items.push({
      id: e.id,
      bereich,
      to,
      titel: e.name,
      untertitel: e.adresse,
      schlagworte: `${e.name} ${e.adresse} ${e.ansprechpartner}`,
    });
  }
  for (const kk of KRANKENKASSEN) {
    items.push({
      id: kk.id,
      bereich: "Kunden",
      to: "/kunden",
      titel: kk.name,
      untertitel: `Krankenkasse · ${kk.vertragsstatus}`,
      schlagworte: `${kk.name} ${kk.kuerzel} krankenkasse ${kk.vertragsstatus}`,
    });
  }

  return items;
}

export function searchAll(query: string, limit = 12): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return buildSearchIndex()
    .map((item) => {
      const hay = `${item.titel} ${item.untertitel} ${item.schlagworte}`.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      return { item, score };
    })
    .filter((r) => r.score === terms.length)
    .slice(0, limit)
    .map((r) => r.item);
}

/** Kompakter Wissens-Snapshot für den Kontext der KI. */
export function buildKnowledgeSnapshot(): string {
  const fahrerFrei = INITIAL_FAHRER.filter((f) => f.status === "verfuegbar");
  const fahrerUnterwegs = INITIAL_FAHRER.filter((f) => f.status === "unterwegs");
  const fzgFrei = INITIAL_FAHRZEUGE.filter((v) => v.status === "frei");
  const fzgUnterwegs = INITIAL_FAHRZEUGE.filter((v) => v.status === "unterwegs");
  const umsatzHeute = INITIAL_FAHRER.reduce((s, f) => s + f.umsatzHeute, 0);
  const gewinnHeute = INITIAL_FAHRER.reduce((s, f) => s + f.gewinnHeute, 0);
  const offene = INITIAL_AUFTRAEGE.filter((a) => a.status === "neu" || a.status === "disponiert");

  const lines: string[] = [];
  lines.push(`# Unternehmenswissen (Stand jetzt)`);
  lines.push(
    `Kennzahlen heute: Umsatz ${EUR(umsatzHeute)}, Gewinn ${EUR(gewinnHeute)}, ` +
      `${fahrerFrei.length} freie Fahrer, ${fahrerUnterwegs.length} unterwegs, ` +
      `${fzgFrei.length} freie Fahrzeuge, ${fzgUnterwegs.length} unterwegs.`,
  );

  lines.push(`\n## Fahrer (${INITIAL_FAHRER.length})`);
  for (const f of INITIAL_FAHRER) {
    lines.push(
      `- ${f.name} (${f.nummer}): ${f.status}, Bewertung ${f.bewertung}/5, Pünktlichkeit ${f.puenktlichkeit}%, ` +
        `Überstunden ${f.ueberstunden}h, Fahrzeug ${f.fahrzeug ?? "—"}.`,
    );
  }

  lines.push(`\n## Fahrzeuge (${INITIAL_FAHRZEUGE.length})`);
  for (const v of INITIAL_FAHRZEUGE) {
    lines.push(
      `- ${v.kennzeichen} ${v.marke} ${v.modell} (${v.typ}): ${v.status}, Tank ${v.tankstand}%, ` +
        `nächste Wartung ${v.naechsteWartung}, TÜV ${v.tuevBis}, Versicherung bis ${v.versicherungBis}.`,
    );
  }

  lines.push(`\n## Aktuelle Aufträge (${INITIAL_AUFTRAEGE.length})`);
  for (const a of INITIAL_AUFTRAEGE) {
    lines.push(
      `- ${a.nummer} ${a.patient}: ${a.transportart}, ${STATUS_META[a.status].label}, ` +
        `${a.abholort} → ${a.zielort}, ${formatTermin(a.termin)}, Fahrer ${a.fahrer ?? "—"}.`,
    );
  }
  lines.push(`Offene/disponierte Aufträge: ${offene.length}.`);

  lines.push(`\n## Patienten (${PATIENTEN.length})`);
  for (const p of PATIENTEN) lines.push(`- ${p.name}: ${p.mobilitaet}, ${p.kostentraeger}, ${p.hinweis}`);

  lines.push(`\n## Kunden & Kassen`);
  for (const k of KUNDEN) lines.push(`- ${k.name} (${k.typ}), offene Rechnungen: ${k.offeneRechnungen}`);

  lines.push(`\n## Einrichtungen`);
  lines.push(`Krankenhäuser: ${KRANKENHAEUSER.map((e) => e.name).join(", ")}`);
  lines.push(`Dialysezentren: ${DIALYSEZENTREN.map((e) => e.name).join(", ")}`);
  lines.push(`Pflegeheime: ${PFLEGEHEIME.map((e) => e.name).join(", ")}`);

  return lines.join("\n");
}
