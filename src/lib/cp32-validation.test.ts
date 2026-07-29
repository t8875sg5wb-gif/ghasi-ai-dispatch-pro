import { expect, test } from "bun:test";
import { invoiceFieldsSchema } from "@/lib/invoices.functions";
import { rowToRechnung, rechnungToWrite, type InvoiceRow } from "@/lib/invoices-shared";

// Echte Bestandszeilen aus `invoices` (1:1 kopiert, Stand CP32).
const BESTAND: InvoiceRow[] = [
  {
    id: "3e68554b-9334-4564-ac52-9197317f271c",
    nummer: "RE-2026-0041",
    typ: "rechnung",
    kunde: "AOK Nordost",
    kunde_id: "k-1",
    abrechnungsart: "Krankenkasse",
    betrag: 1240,
    mwst_satz: 0,
    status: "ueberfaellig",
    datum: "2026-05-02",
    faelligkeit: "2026-05-16",
    leistungsdatum: null,
    bezahlt_am: null,
    bezahlter_betrag: null,
    bezug_auftrag: "A-2041",
    positionen: [
      { beschreibung: "Dialysefahrten Mai (12×)", menge: 12, einzelpreis: 96 },
      { beschreibung: "Wartezeitpauschale", menge: 4, einzelpreis: 22 },
    ],
    notiz: "Sammelrechnung Dialyse.",
    mahnstufe: 0,
    letzte_mahnung: null,
    mahn_historie: [],
    zahlungen: [],
  },
  {
    // Gutschrift: negativer Gesamtbetrag UND negativer Einzelpreis.
    id: "1b4a0bf3-c256-4776-ae44-a9659f5e6bbc",
    nummer: "GU-2026-0007",
    typ: "gutschrift",
    kunde: "AOK Nordost",
    kunde_id: "k-1",
    abrechnungsart: "Krankenkasse",
    betrag: -180,
    mwst_satz: 0,
    status: "bezahlt",
    datum: "2026-05-20",
    faelligkeit: "2026-05-20",
    leistungsdatum: null,
    bezahlt_am: "2026-05-20",
    bezahlter_betrag: -180,
    bezug_auftrag: null,
    positionen: [{ beschreibung: "Storno doppelt berechnete Fahrt", menge: 1, einzelpreis: -180 }],
    notiz: null,
    mahnstufe: 0,
    letzte_mahnung: null,
    mahn_historie: [],
    zahlungen: [],
  },
];

test("Bestandsrechnungen (inkl. Gutschrift) passieren das neue Schema", () => {
  for (const row of BESTAND) {
    const write = rechnungToWrite(rowToRechnung(row));
    const parsed = invoiceFieldsSchema.safeParse(write);
    expect(parsed.success).toBe(true);
  }
});

test("GoBD-Audit-Felder werden akzeptiert", () => {
  const ok = invoiceFieldsSchema.safeParse({
    status: "teilbezahlt",
    betrag: 320,
    mwstSatz: 19,
    datum: "2026-06-01",
    faelligkeit: "2026-06-15",
    leistungsdatum: "2026-05-31",
    bezahltAm: null,
    bezahlterBetrag: 160,
    kunde: "DAK Gesundheit",
    abrechnungsart: "Krankenkasse",
    notiz: "Teilzahlung eingegangen.",
    mahnstufe: 1,
    letzteMahnung: "2026-06-20T08:00:00.000Z",
    mahnHistorie: [{ stufe: 1, datum: "2026-06-20T08:00:00.000Z", tageUeberfaellig: 5 }],
    zahlungen: [{ datum: "2026-06-10", betrag: 160, notiz: "Bank" }],
  });
  expect(ok.success).toBe(true);
});

test("Gutschrift-Beträge bleiben erlaubt, Unsinn wird abgelehnt", () => {
  expect(invoiceFieldsSchema.safeParse({ betrag: -180, bezahlterBetrag: -180 }).success).toBe(true);
  expect(
    invoiceFieldsSchema.safeParse({ zahlungen: [{ datum: "2026-05-20", betrag: -180 }] }).success,
  ).toBe(true);
  expect(invoiceFieldsSchema.safeParse({ datum: "20.05.2026" }).success).toBe(false);
  expect(invoiceFieldsSchema.safeParse({ status: "gesendet" }).success).toBe(false);
  expect(invoiceFieldsSchema.safeParse({ typ: "storno" }).success).toBe(false);
  expect(invoiceFieldsSchema.safeParse({ mahnstufe: 4 }).success).toBe(false);
  expect(invoiceFieldsSchema.safeParse({ mwstSatz: 120 }).success).toBe(false);
  expect(invoiceFieldsSchema.safeParse({ kunde: "  " }).success).toBe(false);
  expect(invoiceFieldsSchema.safeParse({ hackerFeld: 1 }).success).toBe(false);
  expect(
    invoiceFieldsSchema.safeParse({ positionen: [{ beschreibung: "", menge: 1, einzelpreis: 1 }] })
      .success,
  ).toBe(false);
});
