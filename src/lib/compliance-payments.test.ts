import { describe, expect, it } from "bun:test";

import { computeZahlungsUebersicht, type ComplianceInput } from "@/lib/compliance";
import type { Versicherung } from "@/lib/versicherungen";
import type { Leasingvertrag } from "@/lib/leasing";

function basis(versicherungen: Versicherung[], leasing: Leasingvertrag[]): ComplianceInput {
  return {
    fahrzeuge: [],
    fahrer: [],
    versicherungen,
    leasing,
    patienten: [],
    auftraege: [],
    rechnungen: [],
    vertraege: [],
    kassen: [],
    company: {} as ComplianceInput["company"],
  };
}

describe("Compliance Zahlungsuebersicht", () => {
  it("zaehlt abgelaufene Versicherung trotz Rohstatus aktiv nicht weiter", () => {
    const alt: Versicherung = {
      id: "v-alt",
      versicherer: "Test",
      policennummer: "ALT",
      art: "Haftpflicht",
      fahrzeug: "MI-X 1",
      beitragMonat: 100,
      selbstbeteiligung: 0,
      beginn: "2020-01-01",
      ablauf: "2020-12-31",
      status: "aktiv",
    };
    const aktiv: Versicherung = {
      ...alt,
      id: "v-neu",
      policennummer: "NEU",
      beitragMonat: 50,
      ablauf: "2099-12-31",
    };
    const z = computeZahlungsUebersicht(basis([alt, aktiv], []), 0);
    expect(z.ausgehend.find((p) => p.titel.includes("Versicherungs"))?.betrag).toBe(50);
  });

  it("zaehlt beendeten Leasingvertrag trotz Rohstatus aktiv nicht weiter", () => {
    const alt: Leasingvertrag = {
      id: "l-alt",
      leasinggeber: "Test",
      vertragsnummer: "ALT",
      fahrzeug: "MI-X 1",
      rateMonat: 700,
      beginn: "2019-01-01",
      ende: "2020-01-01",
      restwert: 0,
      laufzeitMonate: 12,
      kmInklusive: 10000,
      kmAktuell: 1000,
      status: "aktiv",
    };
    const aktiv: Leasingvertrag = {
      ...alt,
      id: "l-neu",
      vertragsnummer: "NEU",
      rateMonat: 300,
      ende: "2099-12-31",
    };
    const z = computeZahlungsUebersicht(basis([], [alt, aktiv]), 0);
    expect(z.ausgehend.find((p) => p.titel.includes("Leasing"))?.betrag).toBe(300);
  });
});
