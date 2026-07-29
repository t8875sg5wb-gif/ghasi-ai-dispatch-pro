// CP33: Partial-update mapper semantics.
// (a) omitted fields must NOT appear as keys in the row object
// (b) explicitly set null/false/[] must still be written through
import { expect, test } from "bun:test";
import { patientToRow } from "@/lib/patients-shared";
import { kundeToRow } from "@/lib/customers-shared";
import { einrichtungToRow } from "@/lib/facilities-shared";
import { anrufToRow } from "@/lib/calls-shared";
import { ausgabeToRow } from "@/lib/expenses-shared";
import { leasingToRow } from "@/lib/leasing-shared";
import { konversationToRow } from "@/lib/communication-shared";

test("patientToRow: partial update touches only the given field", () => {
  const row = patientToRow({ name: "Neu" });
  expect(Object.keys(row)).toEqual(["name"]);
  for (const k of [
    "telefon",
    "medizinische_notiz",
    "patientennotiz",
    "kostentraeger_id",
    "versichertennummer",
    "zuzahlungsbefreit_bis",
    "verordnung_dokument_id",
    "genehmigung_bis",
  ]) {
    expect(k in row).toBe(false);
  }
});

test("patientToRow: explicit null still clears", () => {
  const row = patientToRow({ telefon: undefined, kostentraegerId: null, genehmigungBis: null });
  expect(row.kostentraeger_id).toBe(null);
  expect(row.genehmigung_bis).toBe(null);
  expect("telefon" in row).toBe(false);
});

test("kundeToRow: partial update touches only the given field", () => {
  const row = kundeToRow({ name: "Firma" });
  expect(Object.keys(row)).toEqual(["name"]);
  for (const k of [
    "email",
    "adresse",
    "vertragsstatus",
    "konditionen",
    "zahlungsziel_tage",
    "kreditlimit",
    "umsatz_jahr",
    "notiz",
  ]) {
    expect(k in row).toBe(false);
  }
});

test("kundeToRow: explicit null still clears", () => {
  const row = kundeToRow({ notiz: null as unknown as undefined, kreditlimit: null as never });
  expect(row.notiz).toBe(null);
  expect(row.kreditlimit).toBe(null);
});

test("einrichtungToRow: partial update touches only the given field", () => {
  const row = einrichtungToRow({ name: "Klinik" });
  expect(Object.keys(row)).toEqual(["name"]);
  for (const k of [
    "email",
    "fachbereiche",
    "kapazitaet",
    "oeffnungszeiten",
    "kostentraeger",
    "notiz",
  ]) {
    expect(k in row).toBe(false);
  }
});

test("einrichtungToRow: explicit empty array / null still written", () => {
  const row = einrichtungToRow({ fachbereiche: [], notiz: null as never });
  expect(row.fachbereiche).toEqual([]);
  expect(row.notiz).toBe(null);
});

test("anrufToRow: partial update touches only the given field", () => {
  const row = anrufToRow({ nummer: "0170" });
  expect(Object.keys(row)).toEqual(["nummer"]);
  for (const k of ["name", "notiz", "auftrag_erstellt"]) {
    expect(k in row).toBe(false);
  }
});

test("anrufToRow: explicit false / null still written", () => {
  const row = anrufToRow({ auftragErstellt: false, notiz: null as never });
  expect(row.auftrag_erstellt).toBe(false);
  expect(row.notiz).toBe(null);
});

test("ausgabeToRow: partial update touches only the given field", () => {
  const row = ausgabeToRow({ lieferant: "Aral" });
  expect(Object.keys(row)).toEqual(["lieferant"]);
  for (const k of ["fahrzeug_id", "fahrer_id", "notiz", "beleg_dokument_id"]) {
    expect(k in row).toBe(false);
  }
});

test("ausgabeToRow: explicit null still clears", () => {
  const row = ausgabeToRow({ fahrzeugId: null, belegDokumentId: null });
  expect(row.fahrzeug_id).toBe(null);
  expect(row.beleg_dokument_id).toBe(null);
});

test("leasingToRow: partial update touches only the given field", () => {
  const row = leasingToRow({ vertragsnummer: "L-1" });
  expect(Object.keys(row)).toEqual(["vertragsnummer"]);
  expect("notiz" in row).toBe(false);
});

test("leasingToRow: explicit null still clears", () => {
  const row = leasingToRow({ notiz: null as never });
  expect(row.notiz).toBe(null);
});

test("konversationToRow: partial update touches only the given field", () => {
  const row = konversationToRow({ betreff: "Test" });
  expect(Object.keys(row)).toEqual(["betreff"]);
  expect("bezug" in row).toBe(false);
});

test("konversationToRow: explicit null still clears", () => {
  const row = konversationToRow({ bezug: null as never });
  expect(row.bezug).toBe(null);
});
