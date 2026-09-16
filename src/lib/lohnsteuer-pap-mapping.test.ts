import { describe, expect, it } from "bun:test";

import { berechneLohnsteuerPap2026 } from "@/lib/lohnsteuer-2026";
import {
  mappeLohnfaktenZuPap2026,
  PAP_2026_DERIVED_INPUTS,
  PAP_2026_FACT_MAPPING,
} from "@/lib/lohnsteuer-pap-mapping";
import type { LohnFakt } from "@/lib/payroll-shared";

const FAHRER = "11111111-1111-4111-8111-111111111111";

function fakt(
  schluessel: string,
  wert: string,
  status: LohnFakt["status"] = "verifiziert",
): LohnFakt {
  return {
    id: `${schluessel.padEnd(8, "0").slice(0, 8)}-1111-4111-8111-111111111111`,
    fahrerId: FAHRER,
    faktSchluessel: schluessel,
    wert,
    gueltigAb: "2026-01-01",
    gueltigBis: null,
    status,
    version: 2,
    notiz: "synthetischer Test",
    erstelltVon: null,
    verifiziertVon: null,
    verifiziertAm: "2026-01-02T00:00:00Z",
    createdAt: "",
    updatedAt: "",
  };
}
function vollstaendigeFakten(): LohnFakt[] {
  const werte: Record<string, string> = Object.fromEntries(
    PAP_2026_FACT_MAPPING.map((d) => [d.faktSchluessel, "0"]),
  );
  werte.pap_af = "1";
  werte.pap_faktor = "1";
  werte.pap_kvz_prozent = "2.5";
  werte.pap_pvz = "1";
  werte.steuerklasse = "1";
  werte.kinderfreibetraege = "0";
  return PAP_2026_FACT_MAPPING.map((d) => fakt(d.faktSchluessel, werte[d.faktSchluessel]!));
}

describe("PAP-2026 Mitarbeiterdaten-Mapping", () => {
  it("deckt alle 35 PAP-Eingaben nachvollziehbar ab", () => {
    expect(PAP_2026_FACT_MAPPING).toHaveLength(33);
    expect(PAP_2026_DERIVED_INPUTS).toEqual(["LZZ", "RE4"]);
    const names = new Set(PAP_2026_FACT_MAPPING.map((x) => x.pap));
    expect(names.size).toBe(33);
    expect(names.has("LZZ")).toBe(false);
    expect(names.has("RE4")).toBe(false);
  });

  it("unterscheidet fehlenden Fakt von verifiziertem Nullwert", () => {
    const fakten = vollstaendigeFakten().filter((f) => f.faktSchluessel !== "pap_sonstb_cent");
    const fehlt = mappeLohnfaktenZuPap2026({
      monat: "2026-08",
      fahrerId: FAHRER,
      bruttoEuro: 5000,
      fakten,
    });
    expect(fehlt.status).toBe("unvollstaendig");
    expect(fehlt.probleme.some((p) => p.faktSchluessel === "pap_sonstb_cent")).toBe(true);

    fakten.push(fakt("pap_sonstb_cent", "0"));
    const nullIstWert = mappeLohnfaktenZuPap2026({
      monat: "2026-08",
      fahrerId: FAHRER,
      bruttoEuro: 5000,
      fakten,
    });
    expect(nullIstWert.status).toBe("bereit");
  });
  it("ignoriert ungeprüfte Fakten und verlangt volle Monatsabdeckung", () => {
    const fakten = vollstaendigeFakten();
    const idx = fakten.findIndex((f) => f.faktSchluessel === "steuerklasse");
    fakten[idx] = { ...fakten[idx]!, status: "pruefung_erforderlich" };
    let r = mappeLohnfaktenZuPap2026({
      monat: "2026-08",
      fahrerId: FAHRER,
      bruttoEuro: 5000,
      fakten,
    });
    expect(r.status).toBe("unvollstaendig");
    expect(r.probleme.some((p) => p.faktSchluessel === "steuerklasse")).toBe(true);

    fakten[idx] = { ...fakt("steuerklasse", "1"), gueltigAb: "2026-08-10" };
    r = mappeLohnfaktenZuPap2026({ monat: "2026-08", fahrerId: FAHRER, bruttoEuro: 5000, fakten });
    expect(r.status).toBe("unvollstaendig");
  });

  it("bildet einen vollständigen Monatsfall und trifft den amtlich gegengeprüften Referenzwert", () => {
    const r = mappeLohnfaktenZuPap2026({
      monat: "2026-08",
      fahrerId: FAHRER,
      bruttoEuro: 5000,
      fakten: vollstaendigeFakten(),
    });
    expect(r.status).toBe("bereit");
    if (r.status !== "bereit") return;
    expect(r.input.LZZ).toBe(2);
    expect(r.input.RE4).toBe(500000);
    expect(r.input.STKL).toBe(1);
    expect(r.input.SONSTB).toBe(0);
    const steuer = berechneLohnsteuerPap2026(r.input);
    expect(steuer.LSTLZZ).toBe(78583);
  });

  it("blockiert ungültige Faktwerte statt Paket-Defaults einzusetzen", () => {
    const fakten = vollstaendigeFakten();
    const idx = fakten.findIndex((f) => f.faktSchluessel === "steuerklasse");
    fakten[idx] = fakt("steuerklasse", "9");
    const r = mappeLohnfaktenZuPap2026({
      monat: "2026-08",
      fahrerId: FAHRER,
      bruttoEuro: 5000,
      fakten,
    });
    expect(r.status).toBe("unvollstaendig");
    expect(r.probleme.length).toBeGreaterThan(0);
  });
});
