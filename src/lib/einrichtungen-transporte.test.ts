import { describe, it, expect } from "bun:test";

import { transporteFuerEinrichtung } from "./einrichtungen-transporte";

const basis = { abholort: "", zielort: "" };

describe("transporteFuerEinrichtung", () => {
  it("zeigt bei gesetzter ID-Verknüpfung keine fremden Transporte, auch wenn der Name Teilstring einer fremden Adresse ist", () => {
    const auftraege = [
      {
        id: "eigen",
        ...basis,
        abholort: "Musterweg 1, 32423 Minden",
        pickupEinrichtungId: "f-klinik",
        destinationEinrichtungId: null,
      },
      {
        id: "fremd",
        ...basis,
        // Der kurze Name "Klinik" steckt zufällig in dieser fremden Adresse.
        abholort: "Am Klinikpark 7, 32427 Minden",
        zielort: "Bahnhofstraße 2, 32423 Minden",
        pickupEinrichtungId: "f-anderes-haus",
        destinationEinrichtungId: null,
      },
    ];

    const treffer = transporteFuerEinrichtung("f-klinik", "Klinik", auftraege);
    expect(treffer.map((a) => a.id)).toEqual(["eigen"]);
  });

  it("nutzt den Teilstring-Fallback nur für Aufträge ohne jede Einrichtungs-ID", () => {
    const auftraege = [
      {
        id: "freitext",
        ...basis,
        zielort: "Klinikum Minden, Hauptstraße 1",
        pickupEinrichtungId: null,
        destinationEinrichtungId: null,
      },
      {
        id: "verknuepft-anders",
        ...basis,
        zielort: "Klinikum Minden, Hauptstraße 1",
        pickupEinrichtungId: null,
        destinationEinrichtungId: "f-anderes-haus",
      },
    ];

    const treffer = transporteFuerEinrichtung("f-klinikum", "Klinikum Minden", auftraege);
    expect(treffer.map((a) => a.id)).toEqual(["freitext"]);
  });
});
