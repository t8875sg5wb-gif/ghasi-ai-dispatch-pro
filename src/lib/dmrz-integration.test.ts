import { describe, expect, it } from "bun:test";

import {
  DMRZ_GESPERRTE_AKTIONEN,
  DMRZ_INTEGRATION_STATUS,
  dmrzSperrgruende,
  dmrzUebertragungFreigegeben,
} from "@/lib/dmrz-integration";

describe("DMRZ-Integrationsgrenze", () => {
  it("bleibt ohne offizielle technische Spezifikation gesperrt", () => {
    expect(DMRZ_INTEGRATION_STATUS).toBe("spezifikation_ausstehend");
    expect(
      dmrzUebertragungFreigegeben({
        offizielleTechnischeSpezifikationVerifiziert: false,
        menschlicheUnternehmerfreigabe: true,
      }),
    ).toBe(false);
  });

  it("behandelt menschliche Freigabe als eigene zwingende Schranke", () => {
    expect(
      dmrzUebertragungFreigegeben({
        offizielleTechnischeSpezifikationVerifiziert: true,
        menschlicheUnternehmerfreigabe: false,
      }),
    ).toBe(false);
  });

  it("nennt beide Sperrgruende, solange nichts freigegeben ist", () => {
    expect(
      dmrzSperrgruende({
        offizielleTechnischeSpezifikationVerifiziert: false,
        menschlicheUnternehmerfreigabe: false,
      }),
    ).toEqual([
      "Offizielle technische DMRZ-Spezifikation fehlt oder ist nicht verifiziert.",
      "Menschliche Unternehmerfreigabe fehlt.",
    ]);
  });

  it("gibt erst bei verifizierter Spezifikation plus Mensch frei", () => {
    expect(
      dmrzUebertragungFreigegeben({
        offizielleTechnischeSpezifikationVerifiziert: true,
        menschlicheUnternehmerfreigabe: true,
      }),
    ).toBe(true);
    expect(DMRZ_GESPERRTE_AKTIONEN).toContain("DMRZ-Feldnamen oder Codes erfinden");
  });
});
