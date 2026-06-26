// ============================================================
// GHASI AI — Enterprise Reporting Engine
// ------------------------------------------------------------
// Builds tabular reports from the live application data (finance,
// fleet, drivers, transports, customers, patients, maintenance,
// fuel) and provides CSV / Excel / print(PDF) export helpers.
//
// Reports are pure data structures (Bericht) so the same definition
// powers the on-screen table and every export format. Existing
// modules stay untouched.
// ============================================================
import { INITIAL_FAHRER } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE, reparaturkostenGesamt, fahrzeugWarnungen } from "@/lib/fahrzeuge";
import { INITIAL_AUFTRAEGE, STATUS_META } from "@/lib/auftraege";
import { KUNDEN, PATIENTEN } from "@/lib/stammdaten";
import {
  INITIAL_RECHNUNGEN,
  computeFinanzKpis,
  computeKostenaufstellung,
  EUR,
  netto,
} from "@/lib/finance";

export type BerichtTyp =
  | "umsatz"
  | "gewinn"
  | "fahrzeugauslastung"
  | "fahrerleistung"
  | "kunden"
  | "patienten"
  | "transporte"
  | "kraftstoff"
  | "wartung";

export interface Bericht {
  typ: BerichtTyp;
  titel: string;
  beschreibung: string;
  spalten: string[];
  zeilen: (string | number)[][];
  /** optional summary line rendered below the table */
  summe?: (string | number)[];
}

const round = (n: number, d = 0) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export const BERICHT_LISTE: { typ: BerichtTyp; titel: string; beschreibung: string }[] = [
  { typ: "umsatz", titel: "Umsatzbericht", beschreibung: "Umsatz je Kunde inkl. Netto & MwSt." },
  { typ: "gewinn", titel: "Gewinnbericht", beschreibung: "Umsatz, Kosten und Gewinn der Flotte." },
  {
    typ: "fahrzeugauslastung",
    titel: "Fahrzeugauslastung",
    beschreibung: "Status, Umsatz & Gewinn je Fahrzeug.",
  },
  {
    typ: "fahrerleistung",
    titel: "Fahrerleistung",
    beschreibung: "Pünktlichkeit, Bewertung & Umsatz je Fahrer.",
  },
  { typ: "kunden", titel: "Kundenstatistik", beschreibung: "Umsatz & offene Posten je Kunde." },
  {
    typ: "patienten",
    titel: "Patientenstatistik",
    beschreibung: "Mobilität & Kostenträger der Patienten.",
  },
  {
    typ: "transporte",
    titel: "Transportstatistik",
    beschreibung: "Transporte nach Art und Status.",
  },
  {
    typ: "kraftstoff",
    titel: "Kraftstoffbericht",
    beschreibung: "Verbrauch & Reichweite der Flotte.",
  },
  {
    typ: "wartung",
    titel: "Wartungsbericht",
    beschreibung: "Fristen & aufgelaufene Reparaturkosten.",
  },
];

export function buildBericht(typ: BerichtTyp): Bericht {
  switch (typ) {
    case "umsatz": {
      const zeilen = INITIAL_RECHNUNGEN.filter((r) => r.typ === "rechnung").map((r) => [
        r.nummer,
        r.kunde,
        r.abrechnungsart,
        round(netto(r)),
        round(r.betrag - netto(r)),
        r.betrag,
      ]);
      const gesamt = zeilen.reduce((s, z) => s + Number(z[5]), 0);
      return {
        typ,
        titel: "Umsatzbericht",
        beschreibung: "Umsatz je Rechnung inkl. Netto & MwSt.",
        spalten: ["Nummer", "Kunde", "Abrechnung", "Netto €", "MwSt €", "Brutto €"],
        zeilen,
        summe: ["Gesamt", "", "", "", "", gesamt],
      };
    }
    case "gewinn": {
      const k = computeFinanzKpis();
      const zeilen = INITIAL_FAHRZEUGE.map((v) => [
        v.kennzeichen,
        `${v.marke} ${v.modell}`,
        v.monatsumsatz,
        v.monatsumsatz - v.monatsgewinn,
        v.monatsgewinn,
        `${round((v.monatsgewinn / Math.max(1, v.monatsumsatz)) * 100)} %`,
      ]);
      return {
        typ,
        titel: "Gewinnbericht",
        beschreibung: "Umsatz, Kosten und Gewinn je Fahrzeug (Monat).",
        spalten: ["Kennzeichen", "Fahrzeug", "Umsatz €", "Kosten €", "Gewinn €", "Marge"],
        zeilen,
        summe: [
          "Gesamt",
          "",
          k.umsatzMonat,
          k.umsatzMonat - k.gewinnMonat,
          k.gewinnMonat,
          `${k.margeProzent} %`,
        ],
      };
    }
    case "fahrzeugauslastung": {
      const zeilen = INITIAL_FAHRZEUGE.map((v) => [
        v.kennzeichen,
        v.typ,
        v.status,
        v.kilometerstand,
        v.monatsumsatz,
        v.monatsgewinn,
      ]);
      return {
        typ,
        titel: "Fahrzeugauslastung",
        beschreibung: "Status, Kilometerstand, Umsatz & Gewinn je Fahrzeug.",
        spalten: ["Kennzeichen", "Typ", "Status", "km-Stand", "Umsatz €", "Gewinn €"],
        zeilen,
      };
    }
    case "fahrerleistung": {
      const zeilen = INITIAL_FAHRER.map((f) => [
        f.name,
        f.nummer,
        `${f.puenktlichkeit} %`,
        `${f.bewertung}/5`,
        f.ueberstunden,
        f.umsatzHeute,
      ]);
      return {
        typ,
        titel: "Fahrerleistung",
        beschreibung: "Pünktlichkeit, Bewertung, Überstunden & Umsatz je Fahrer.",
        spalten: [
          "Fahrer",
          "Nummer",
          "Pünktlichkeit",
          "Bewertung",
          "Überstunden",
          "Umsatz heute €",
        ],
        zeilen,
      };
    }
    case "kunden": {
      const zeilen = KUNDEN.map((c) => {
        const umsatz = INITIAL_RECHNUNGEN.filter(
          (r) => r.kundeId === c.id && r.typ === "rechnung",
        ).reduce((s, r) => s + r.betrag, 0);
        return [c.name, c.typ, umsatz, c.offeneRechnungen];
      });
      return {
        typ,
        titel: "Kundenstatistik",
        beschreibung: "Umsatz & offene Rechnungen je Kunde.",
        spalten: ["Kunde", "Typ", "Umsatz €", "Offene Rechnungen"],
        zeilen,
      };
    }
    case "patienten": {
      const zeilen = PATIENTEN.map((p) => [p.name, p.mobilitaet, p.kostentraeger, p.hinweis]);
      return {
        typ,
        titel: "Patientenstatistik",
        beschreibung: "Mobilität, Kostenträger & Hinweise.",
        spalten: ["Patient", "Mobilität", "Kostenträger", "Hinweis"],
        zeilen,
      };
    }
    case "transporte": {
      const zeilen = INITIAL_AUFTRAEGE.map((a) => [
        a.nummer,
        a.patient,
        a.transportart,
        STATUS_META[a.status].label,
        a.fahrer ?? "—",
        a.kostentraeger,
      ]);
      return {
        typ,
        titel: "Transportstatistik",
        beschreibung: "Transporte nach Art, Status & Fahrer.",
        spalten: ["Nummer", "Patient", "Art", "Status", "Fahrer", "Kostenträger"],
        zeilen,
      };
    }
    case "kraftstoff": {
      const zeilen = INITIAL_FAHRZEUGE.map((v) => [
        v.kennzeichen,
        v.kraftstoff,
        `${v.verbrauch} ${v.kraftstoff === "Elektro" ? "kWh" : "l"}/100km`,
        `${v.tankstand} %`,
        `${v.reichweite} km`,
      ]);
      const k = computeKostenaufstellung();
      return {
        typ,
        titel: "Kraftstoffbericht",
        beschreibung: "Verbrauch, Tankstand & Reichweite der Flotte.",
        spalten: ["Kennzeichen", "Kraftstoff", "Verbrauch", "Tankstand", "Reichweite"],
        zeilen,
        summe: ["Geschätzte Kraftstoffkosten/Monat", "", "", "", EUR(k.kraftstoffkosten)],
      };
    }
    case "wartung": {
      const zeilen = INITIAL_FAHRZEUGE.map((v) => {
        const w = fahrzeugWarnungen(v);
        return [
          v.kennzeichen,
          v.naechsteWartung,
          v.tuevBis,
          v.reifenstatus,
          reparaturkostenGesamt(v),
          w.hatWarnung ? "Ja" : "Nein",
        ];
      });
      return {
        typ,
        titel: "Wartungsbericht",
        beschreibung: "Fristen, Reifen & aufgelaufene Reparaturkosten.",
        spalten: [
          "Kennzeichen",
          "Nächste Wartung",
          "TÜV bis",
          "Reifen",
          "Reparaturkosten €",
          "Warnung",
        ],
        zeilen,
      };
    }
  }
}

/* ------------------------------------------------------------------ *
 * Export helpers (client-only)
 * ------------------------------------------------------------------ */

export function berichtZuCSV(bericht: Bericht): string {
  const escape = (val: string | number) => {
    const s = String(val);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [bericht.spalten.map(escape).join(";")];
  for (const z of bericht.zeilen) lines.push(z.map(escape).join(";"));
  if (bericht.summe) lines.push(bericht.summe.map(escape).join(";"));
  return lines.join("\n");
}

/** Triggers a CSV download (Excel opens it natively via UTF-8 BOM). */
export function downloadCSV(bericht: Bericht): void {
  if (typeof document === "undefined") return;
  const blob = new Blob(["\uFEFF" + berichtZuCSV(bericht)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${bericht.typ}-bericht.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Opens the browser print dialog scoped to a single report (PDF export). */
export function druckeBericht(bericht: Bericht): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const head = bericht.spalten.map((s) => `<th>${s}</th>`).join("");
  const body = bericht.zeilen
    .map((z) => `<tr>${z.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");
  const summe = bericht.summe
    ? `<tfoot><tr>${bericht.summe.map((c) => `<th>${c}</th>`).join("")}</tr></tfoot>`
    : "";
  w.document
    .write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${bericht.titel} – GHASI AI</title>
    <style>
      body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;padding:32px}
      h1{font-size:20px;margin:0 0 4px} p{color:#64748b;margin:0 0 20px;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:left}
      thead th{background:#1e3a8a;color:#fff} tfoot th{background:#f1f5f9}
    </style></head><body>
    <h1>${bericht.titel}</h1><p>${bericht.beschreibung} · GHASI AI · ${new Date().toLocaleDateString("de-DE")}</p>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${summe}</table>
    </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
