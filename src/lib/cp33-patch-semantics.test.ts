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
import { writeToRow } from "@/lib/drivers-shared";
import { versicherungToRow } from "@/lib/insurance-shared";
import { kassenvertragToRow } from "@/lib/insurer-contracts-shared";
import { shiftToRow } from "@/lib/shifts-shared";
import { fahrtToRow } from "@/lib/trips-shared";

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

/* ------------------------------------------------------------------ *
 * CP34: same patch-semantics fix for three more mappers
 * ------------------------------------------------------------------ */

test("writeToRow (drivers): partial update touches only the given field", () => {
  const row = writeToRow({ name: "Fahrer" });
  expect(Object.keys(row)).toEqual(["name"]);
  for (const k of ["p_schein_gueltig_bis", "fuehrungszeugnis_datum", "steuer_id"]) {
    expect(k in row).toBe(false);
  }
});

test("writeToRow (drivers): explicit null still clears", () => {
  const row = writeToRow({
    pScheinGueltigBis: null as never,
    fuehrungszeugnisDatum: null as never,
    steuerId: null as never,
  });
  expect(row.p_schein_gueltig_bis).toBe(null);
  expect(row.fuehrungszeugnis_datum).toBe(null);
  expect(row.steuer_id).toBe(null);
});

test("versicherungToRow: partial update touches only the given field", () => {
  const row = versicherungToRow({ status: "aktiv" });
  expect(Object.keys(row)).toEqual(["status"]);
  expect("notiz" in row).toBe(false);
});

test("versicherungToRow: explicit null still clears", () => {
  const row = versicherungToRow({ notiz: null as never });
  expect(row.notiz).toBe(null);
});

test("kassenvertragToRow: partial update touches only the given field", () => {
  // `aktenzeichen`/`notiz` nutzen weiterhin einen `?? ""`-Fallback (außerhalb
  // des CP34-Scopes); geprüft werden hier nur die korrigierten Datumsfelder.
  const row = kassenvertragToRow({ leistung: "Sitzendtransport" });
  expect(row.leistung).toBe("Sitzendtransport");
  for (const k of ["gueltig_ab", "gueltig_bis"]) {
    expect(k in row).toBe(false);
  }
});

test("kassenvertragToRow: explicit null still clears", () => {
  const row = kassenvertragToRow({ gueltigAb: null as never, gueltigBis: null as never });
  expect(row.gueltig_ab).toBe(null);
  expect(row.gueltig_bis).toBe(null);
});

/* ------------------------------------------------------------------ *
 * CP35: empty-string variant of the same patch-semantics bug
 * ------------------------------------------------------------------ */

test("kassenvertragToRow: omitted aktenzeichen/notiz produce no keys", () => {
  const row = kassenvertragToRow({ leistung: "Sitzendtransport" });
  expect(Object.keys(row)).toEqual(["leistung"]);
  for (const k of ["aktenzeichen", "notiz"]) {
    expect(k in row).toBe(false);
  }
});

test("kassenvertragToRow: explicit empty string still written", () => {
  const row = kassenvertragToRow({ aktenzeichen: "", notiz: "" });
  expect(row.aktenzeichen).toBe("");
  expect(row.notiz).toBe("");
});

test("shiftToRow: partial update touches only the given field", () => {
  const row = shiftToRow({ typ: "frueh" as never });
  expect(Object.keys(row)).toEqual(["typ"]);
  for (const k of ["von", "bis", "notiz"]) {
    expect(k in row).toBe(false);
  }
});

test("shiftToRow: explicit empty string still written", () => {
  const row = shiftToRow({ von: "", bis: "", notiz: "" });
  expect(row.von).toBe("");
  expect(row.bis).toBe("");
  expect(row.notiz).toBe("");
});

test("fahrtToRow: partial update touches only the given field", () => {
  const row = fahrtToRow({ datum: "2026-07-29" });
  expect(Object.keys(row)).toEqual(["datum"]);
  for (const k of ["fahrer", "zweck", "notiz"]) {
    expect(k in row).toBe(false);
  }
});

test("fahrtToRow: explicit empty string still written", () => {
  const row = fahrtToRow({ fahrer: "", zweck: "", notiz: "" });
  expect(row.fahrer).toBe("");
  expect(row.zweck).toBe("");
  expect(row.notiz).toBe("");
});
