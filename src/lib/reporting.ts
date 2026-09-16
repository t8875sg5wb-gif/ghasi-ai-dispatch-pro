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
import { type Fahrer } from "@/lib/fahrer";
import { reparaturkostenGesamt, fahrzeugWarnungen, type Fahrzeug } from "@/lib/fahrzeuge";
import { STATUS_META, type Auftrag } from "@/lib/auftraege";
import { type Kunde, type Patient } from "@/lib/stammdaten";
import {
  computeFinanzKpis,
  computeKostenaufstellung,
  computeFahrerFinanzwerte,
  computeFahrzeugFinanzwerte,
  EUR,
  netto,
  type Rechnung,
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

export interface BerichtGrundlage {
  vorhanden: boolean;
  hinweis: string;
}

export interface BerichtDatenzaehler {
  rechnungen: number;
  fahrzeuge: number;
  fahrer: number;
  kunden: number;
  patienten: number;
  auftraege: number;
}

export interface BerichtDaten {
  rechnungen: readonly Rechnung[];
  fahrzeuge: readonly Fahrzeug[];
  fahrer: readonly Fahrer[];
  kunden: readonly Kunde[];
  patienten: readonly Patient[];
  auftraege: readonly Auftrag[];
}

export function bewerteBerichtGrundlage(
  typ: BerichtTyp,
  daten: BerichtDatenzaehler,
): BerichtGrundlage {
  switch (typ) {
    case "umsatz":
      return daten.rechnungen > 0
        ? { vorhanden: true, hinweis: "Rechnungsdaten vorhanden." }
        : {
            vorhanden: false,
            hinweis: "Keine Rechnungsdaten vorhanden – Umsatz ist nicht als 0 € belegt.",
          };
    case "gewinn": {
      const fehlt = [
        daten.rechnungen === 0 ? "Rechnungen" : null,
        daten.fahrzeuge === 0 ? "Fahrzeuge" : null,
        daten.fahrer === 0 ? "Fahrer" : null,
      ].filter(Boolean);
      return fehlt.length === 0
        ? { vorhanden: true, hinweis: "Rechnungs-, Fahrzeug- und Fahrerdaten vorhanden." }
        : {
            vorhanden: false,
            hinweis: `Datenbasis fehlt: ${fehlt.join(", ")}. Gewinn wird nicht als 0 ausgewiesen.`,
          };
    }
    case "fahrzeugauslastung":
    case "kraftstoff":
    case "wartung":
      return daten.fahrzeuge > 0
        ? { vorhanden: true, hinweis: "Fahrzeugdaten vorhanden." }
        : { vorhanden: false, hinweis: "Keine Fahrzeugdaten vorhanden." };
    case "fahrerleistung":
      return daten.fahrer > 0
        ? { vorhanden: true, hinweis: "Fahrerdaten vorhanden." }
        : { vorhanden: false, hinweis: "Keine Fahrerdaten vorhanden." };
    case "kunden":
      if (daten.kunden === 0) return { vorhanden: false, hinweis: "Keine Kundendaten vorhanden." };
      if (daten.rechnungen === 0)
        return {
          vorhanden: false,
          hinweis:
            "Kunden sind vorhanden, aber Rechnungsdaten fehlen – Umsatz wird nicht als 0 € ausgegeben.",
        };
      return { vorhanden: true, hinweis: "Kunden- und Rechnungsdaten vorhanden." };
    case "patienten":
      return daten.patienten > 0
        ? { vorhanden: true, hinweis: "Patientendaten vorhanden." }
        : { vorhanden: false, hinweis: "Keine Patientendaten vorhanden." };
    case "transporte":
      return daten.auftraege > 0
        ? { vorhanden: true, hinweis: "Auftragsdaten vorhanden." }
        : { vorhanden: false, hinweis: "Keine Auftragsdaten vorhanden." };
  }
}

export function berichtGrundlage(typ: BerichtTyp, daten: BerichtDaten): BerichtGrundlage {
  return bewerteBerichtGrundlage(typ, {
    rechnungen: daten.rechnungen.length,
    fahrzeuge: daten.fahrzeuge.length,
    fahrer: daten.fahrer.length,
    kunden: daten.kunden.length,
    patienten: daten.patienten.length,
    auftraege: daten.auftraege.length,
  });
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

export function buildBericht(typ: BerichtTyp, daten: BerichtDaten): Bericht {
  switch (typ) {
    case "umsatz": {
      const zeilen = daten.rechnungen
        .filter((r) => r.typ === "rechnung")
        .map((r) => [
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
      const k = computeFinanzKpis([...daten.rechnungen], {
        fahrer: daten.fahrer,
        fahrzeuge: daten.fahrzeuge,
        auftraege: daten.auftraege,
        rechnungen: daten.rechnungen,
      });
      const fzgFinanz = new Map(
        computeFahrzeugFinanzwerte(daten.fahrzeuge, daten.auftraege, daten.rechnungen).map((w) => [
          w.fahrzeugId,
          w.monat,
        ]),
      );
      const zeilen = daten.fahrzeuge.map((v) => {
        const monat = fzgFinanz.get(v.id);
        const umsatz = monat?.umsatz ?? 0;
        const gewinn = monat?.gewinn ?? 0;
        return [
          v.kennzeichen,
          `${v.marke} ${v.modell}`,
          umsatz,
          umsatz - gewinn,
          gewinn,
          `${round((gewinn / Math.max(1, umsatz)) * 100)} %`,
        ];
      });
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
      const fzgFinanz = new Map(
        computeFahrzeugFinanzwerte(daten.fahrzeuge, daten.auftraege, daten.rechnungen).map((w) => [
          w.fahrzeugId,
          w.monat,
        ]),
      );
      const zeilen = daten.fahrzeuge.map((v) => [
        v.kennzeichen,
        v.typ,
        v.status,
        v.kilometerstand,
        fzgFinanz.get(v.id)?.umsatz ?? 0,
        fzgFinanz.get(v.id)?.gewinn ?? 0,
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
      const fahrerFinanz = new Map(
        computeFahrerFinanzwerte(daten.fahrer, daten.auftraege, daten.rechnungen).map((w) => [
          w.fahrerId,
          w.heute,
        ]),
      );
      const zeilen = daten.fahrer.map((f) => [
        f.name,
        f.nummer,
        `${f.puenktlichkeit} %`,
        `${f.bewertung}/5`,
        f.ueberstunden,
        fahrerFinanz.get(f.id)?.umsatz ?? 0,
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
      const zeilen = daten.kunden.map((c) => {
        const umsatz = daten.rechnungen
          .filter((r) => r.kundeId === c.id && r.typ === "rechnung")
          .reduce((s, r) => s + r.betrag, 0);
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
      const zeilen = daten.patienten.map((p) => [p.name, p.mobilitaet, p.kostentraeger, p.hinweis]);
      return {
        typ,
        titel: "Patientenstatistik",
        beschreibung: "Mobilität, Kostenträger & Hinweise.",
        spalten: ["Patient", "Mobilität", "Kostenträger", "Hinweis"],
        zeilen,
      };
    }
    case "transporte": {
      const zeilen = daten.auftraege.map((a) => [
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
      const zeilen = daten.fahrzeuge.map((v) => [
        v.kennzeichen,
        v.kraftstoff,
        `${v.verbrauch} ${v.kraftstoff === "Elektro" ? "kWh" : "l"}/100km`,
        `${v.tankstand} %`,
        `${v.reichweite} km`,
      ]);
      const k = computeKostenaufstellung({
        fahrer: daten.fahrer,
        fahrzeuge: daten.fahrzeuge,
        auftraege: daten.auftraege,
        rechnungen: daten.rechnungen,
      });
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
      const zeilen = daten.fahrzeuge.map((v) => {
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

export function berichtZuCSV(bericht: Bericht, grundlage: BerichtGrundlage): string {
  if (!grundlage.vorhanden) {
    throw new Error(`Bericht nicht exportierbar: ${grundlage.hinweis}`);
  }
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
export function downloadCSV(bericht: Bericht, grundlage: BerichtGrundlage): void {
  if (!grundlage.vorhanden || typeof document === "undefined") return;
  const blob = new Blob(["\uFEFF" + berichtZuCSV(bericht, grundlage)], {
    type: "text/csv;charset=utf-8;",
  });
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
export function druckeBericht(bericht: Bericht, grundlage: BerichtGrundlage): void {
  if (!grundlage.vorhanden || typeof window === "undefined") return;
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
