import { describe, expect, it } from "bun:test";

import {
  adresseVollstaendig,
  generateXRechnung,
  istExportierbar,
  XRECHNUNG_KUNDENADRESSE_FEHLT,
  type XrKaeufer,
  type XrVerkaeufer,
} from "@/lib/xrechnung";
import type { Rechnung } from "@/lib/finance";

const verkaeufer: XrVerkaeufer = {
  name: "Krankentransport Minden",
  adresse: { strasse: "Simeonstraße", hausnummer: "1", plz: "32423", ort: "Minden", land: "DE" },
  email: "kontakt@example.de",
  telefon: "0571 000000",
  steuernummer: "123/456/78901",
  ustId: "",
  iban: "DE02 1203 0000 0000 2020 51",
};

const kaeufer: XrKaeufer = {
  name: "AOK Nordwest",
  adresse: { strasse: "Wilhelmstr.", hausnummer: "1", plz: "32427", ort: "Minden", land: "DE" },
  leitwegId: "04011000-1234512345-06",
};

const rechnung: Rechnung = {
  id: "11111111-1111-1111-1111-111111111111",
  nummer: "RE-2026-0001",
  typ: "rechnung",
  kunde: "AOK Nordwest",
  kundeId: "22222222-2222-2222-2222-222222222222",
  abrechnungsart: "Krankenkasse",
  betrag: 120,
  mwstSatz: 0,
  status: "offen",
  datum: "2026-08-01",
  faelligkeit: "2026-08-15",
  leistungsdatum: "2026-07-28",
  positionen: [{ beschreibung: "Krankenfahrt sitzend", menge: 2, einzelpreis: 60 }],
};

describe("XRechnung-Exportentwurf", () => {
  it("exportiert nur ausgestellte Rechnungen", () => {
    expect(istExportierbar("offen")).toBe(true);
    expect(istExportierbar("bezahlt")).toBe(true);
    expect(istExportierbar("entwurf")).toBe(false);
    expect(istExportierbar("storniert")).toBe(false);
  });

  it("erkennt unvollständige Adressen", () => {
    expect(adresseVollstaendig(kaeufer.adresse)).toBe(true);
    expect(
      adresseVollstaendig({ strasse: "A", hausnummer: "", plz: "", ort: "Minden", land: "DE" }),
    ).toBe(false);
  });

  it("erzeugt UBL-XML mit Kernfeldern, Leitweg-ID, IBAN und Befreiungsgrund", () => {
    const { xml, dateiname, leitwegFehlt } = generateXRechnung({
      rechnung,
      verkaeufer,
      kaeufer,
      steuerModus: "befreit_4_17b",
    });
    expect(dateiname).toBe("xrechnung-RE-2026-0001.xml");
    expect(leitwegFehlt).toBe(false);
    expect(xml).toContain("<cbc:ID>RE-2026-0001</cbc:ID>");
    expect(xml).toContain("<cbc:IssueDate>2026-08-01</cbc:IssueDate>");
    expect(xml).toContain("<cbc:StartDate>2026-07-28</cbc:StartDate>");
    expect(xml).toContain("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>");
    expect(xml).toContain("<cbc:BuyerReference>04011000-1234512345-06</cbc:BuyerReference>");
    expect(xml).toContain("<cbc:ID>DE02120300000000202051</cbc:ID>");
    expect(xml).toContain("§ 4 Nr. 17b UStG");
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">120.00</cbc:PayableAmount>');
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="C62">2.00</cbc:InvoicedQuantity>');
  });

  it("meldet fehlende Leitweg-ID ohne erfundenen Platzhalter", () => {
    const { xml, leitwegFehlt } = generateXRechnung({
      rechnung,
      verkaeufer,
      kaeufer: { ...kaeufer, leitwegId: "" },
      steuerModus: "befreit_4_17b",
    });
    expect(leitwegFehlt).toBe(true);
    expect(xml).toContain("<cbc:BuyerReference></cbc:BuyerReference>");
  });

  it("verweigert Export bei unvollständiger Kundenadresse", () => {
    expect(() =>
      generateXRechnung({
        rechnung,
        verkaeufer,
        kaeufer: { ...kaeufer, adresse: { ...kaeufer.adresse, ort: "" } },
        steuerModus: "befreit_4_17b",
      }),
    ).toThrow(XRECHNUNG_KUNDENADRESSE_FEHLT);
  });

  it("verweigert Export ohne IBAN und bei Entwürfen", () => {
    expect(() =>
      generateXRechnung({ rechnung, verkaeufer: { ...verkaeufer, iban: "" }, kaeufer, steuerModus: "befreit_4_17b" }),
    ).toThrow(/IBAN/);
    expect(() =>
      generateXRechnung({
        rechnung: { ...rechnung, status: "entwurf" },
        verkaeufer,
        kaeufer,
        steuerModus: "befreit_4_17b",
      }),
    ).toThrow(/ausgestellte/);
  });

  it("rechnet 19 % USt korrekt und maskiert XML-Sonderzeichen", () => {
    const { xml } = generateXRechnung({
      rechnung: {
        ...rechnung,
        mwstSatz: 19,
        positionen: [{ beschreibung: "Fahrt A & B <Sonderfall>", menge: 1, einzelpreis: 100 }],
      },
      verkaeufer,
      kaeufer,
      steuerModus: "regulaer_19",
    });
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">19.00</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:TaxInclusiveAmount currencyID="EUR">119.00</cbc:TaxInclusiveAmount>');
    expect(xml).toContain("Fahrt A &amp; B &lt;Sonderfall&gt;");
    expect(xml).not.toContain("TaxExemptionReason");
  });
});
