// Tests für die Atomarität der Lohnlauf-Neuberechnung.
//
// Die Neuberechnung schreibt Posten und Kopfdaten nicht mehr über drei
// sequenzielle REST-Aufrufe, sondern über die Datenbankfunktion
// `apply_payroll_run_calculation`, die alles in EINER Transaktion ausführt
// (Zeile gesperrt via FOR UPDATE, Statusprüfung innerhalb der Transaktion).
//
// Hier wird genau diese Semantik nachgebildet und geprüft:
//  - Erfolg  => Posten UND Kopf zeigen konsistent den neuen Stand.
//  - Fehler  => KEINE Teiländerung (alte Posten und alter Kopf unverändert).
import { describe, expect, it } from "bun:test";

type Posten = {
  run_id: string;
  rule_id: string | null;
  regel_kennung: string;
  betrag: number;
};

type Kopf = {
  id: string;
  status: string;
  brutto: number | null;
  netto: number | null;
  version: number;
};

type Db = { runs: Kopf[]; items: Posten[] };

/**
 * Nachbildung von public.apply_payroll_run_calculation: entweder alle drei
 * Schritte wirken, oder keiner (Transaktions-Rollback bei RAISE EXCEPTION).
 */
function applyPayrollRunCalculation(
  db: Db,
  p: { runId: string; items: Omit<Posten, "run_id">[]; status: string; brutto: number | null; netto: number | null },
): { error: { message: string } | null } {
  // Arbeitskopie = Transaktion. Wird nur bei Erfolg übernommen.
  const next: Db = {
    runs: db.runs.map((r) => ({ ...r })),
    items: db.items.map((i) => ({ ...i })),
  };

  const kopf = next.runs.find((r) => r.id === p.runId);
  if (!kopf) return { error: { message: "Lohnlauf nicht gefunden." } };
  if (kopf.status === "freigegeben") {
    return {
      error: {
        message:
          "Ein freigegebener Lohnlauf ist unveraenderlich und kann nicht neu berechnet werden.",
      },
    };
  }

  next.items = next.items.filter((i) => i.run_id !== p.runId);
  next.items.push(...p.items.map((i) => ({ ...i, run_id: p.runId })));

  kopf.status = p.status;
  kopf.brutto = p.brutto;
  kopf.netto = p.netto;
  kopf.version += 1; // setzt in echt der Trigger enforce_payroll_run_rules

  // Commit
  db.runs = next.runs;
  db.items = next.items;
  return { error: null };
}

const RUN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function dbMitAltemStand(status: string): Db {
  return {
    runs: [{ id: RUN, status, brutto: 3000, netto: 2700, version: 4 }],
    items: [{ run_id: RUN, rule_id: null, regel_kennung: "alt_kv", betrag: 300 }],
  };
}

describe("Atomare Lohnlauf-Neuberechnung", () => {
  it("hinterlässt nach Erfolg einen konsistenten Stand aus Posten und Kopf", () => {
    const db = dbMitAltemStand("berechnet");

    const { error } = applyPayrollRunCalculation(db, {
      runId: RUN,
      items: [
        { rule_id: null, regel_kennung: "kv_an", betrag: 321 },
        { rule_id: null, regel_kennung: "rv_an", betrag: 298.53 },
      ],
      status: "berechnet",
      brutto: 3210,
      netto: 2590.47,
    });

    expect(error).toBeNull();
    // Kopf auf neuem Stand …
    expect(db.runs[0]?.brutto).toBe(3210);
    expect(db.runs[0]?.netto).toBe(2590.47);
    expect(db.runs[0]?.version).toBe(5);
    // … und die Posten passen exakt dazu, kein Rest des alten Stands.
    expect(db.items.map((i) => i.regel_kennung)).toEqual(["kv_an", "rv_an"]);
    expect(db.items.some((i) => i.regel_kennung === "alt_kv")).toBe(false);
    expect(db.items.reduce((s, i) => s + i.betrag, 0)).toBeCloseTo(619.53, 2);
  });

  it("lässt bei abgelehnter Neuberechnung eines freigegebenen Laufs alles unverändert", () => {
    const db = dbMitAltemStand("freigegeben");
    const kopfVorher = { ...db.runs[0]! };
    const postenVorher = db.items.map((i) => ({ ...i }));

    const { error } = applyPayrollRunCalculation(db, {
      runId: RUN,
      items: [{ rule_id: null, regel_kennung: "neu_kv", betrag: 999 }],
      status: "berechnet",
      brutto: 9999,
      netto: 9000,
    });

    expect(error?.message).toContain("unveraenderlich");
    // Weder Posten gelöscht/ersetzt …
    expect(db.items).toEqual(postenVorher);
    // … noch Kopf verändert (auch die Version bleibt stehen).
    expect(db.runs[0]).toEqual(kopfVorher);
  });

  it("entfernt bei leerem Postenarray die alten Posten und aktualisiert den Kopf gemeinsam", () => {
    const db = dbMitAltemStand("berechnet");

    const { error } = applyPayrollRunCalculation(db, {
      runId: RUN,
      items: [],
      status: "unvollstaendig",
      brutto: null,
      netto: null,
    });

    expect(error).toBeNull();
    expect(db.items).toHaveLength(0);
    expect(db.runs[0]?.status).toBe("unvollstaendig");
    expect(db.runs[0]?.brutto).toBeNull();
  });
});
