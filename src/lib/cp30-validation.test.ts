import { expect, test } from "bun:test";
import { insurerFieldsSchema } from "@/lib/insurers.functions";
import { insurerContractFieldsSchema } from "@/lib/insurer-contracts.functions";
import { expenseFieldsSchema } from "@/lib/expenses.functions";
import { leasingFieldsSchema } from "@/lib/leasing.functions";
import { callFieldsSchema } from "@/lib/calls.functions";

test("insurer", () => {
  expect(insurerFieldsSchema.safeParse({ name: "AOK", kuerzel: "AOK", vertragsstatus: "Rahmenvertrag" }).success).toBe(true);
  expect(insurerFieldsSchema.safeParse({ name: "AOK", kuerzel: "AOK", vertragsstatus: "Einzelvertrag" }).success).toBe(false);
  expect(insurerFieldsSchema.safeParse({ name: "AOK", kuerzel: "AOK", vertragsstatus: "Einzelfall", x: 1 }).success).toBe(false);
});
test("contract", () => {
  const ok = { insurerId: "11111111-1111-4111-8111-111111111111", leistung: "Liegend", preis: 80, einheit: "pro Fahrt", genehmigt: true, gueltigAb: "2026-01-01" };
  expect(insurerContractFieldsSchema.safeParse(ok).success).toBe(true);
  expect(insurerContractFieldsSchema.safeParse({ ...ok, insurerId: "abc" }).success).toBe(false);
  expect(insurerContractFieldsSchema.safeParse({ ...ok, einheit: "pro Tag" }).success).toBe(false);
  expect(insurerContractFieldsSchema.safeParse({ ...ok, gueltigAb: "01.01.2026" }).success).toBe(false);
});
test("expense", () => {
  const ok = { datum: "2026-01-12", kategorie: "Kraftstoff", lieferant: "Aral", betragBrutto: 118.4, ustSatz: 19, fahrzeugId: null, fahrerId: null, notiz: null, belegDokumentId: null };
  expect(expenseFieldsSchema.safeParse(ok).success).toBe(true);
  expect(expenseFieldsSchema.safeParse({ ...ok, kategorie: "Kaffee" }).success).toBe(false);
  expect(expenseFieldsSchema.safeParse({ ...ok, ustSatz: 120 }).success).toBe(false);
  expect(expenseFieldsSchema.safeParse({ ...ok, fahrzeugId: "kein-uuid" }).success).toBe(false);
});
test("leasing", () => {
  const ok = { leasinggeber: "MB", vertragsnummer: "X1", fahrzeug: "B-KT 142", rateMonat: 689, beginn: "2024-01-15", ende: "2027-01-14", restwert: 14500, laufzeitMonate: 36, kmInklusive: 90000, kmAktuell: 41200, status: "aktiv", notiz: "x" };
  expect(leasingFieldsSchema.safeParse(ok).success).toBe(true);
  expect(leasingFieldsSchema.safeParse({ ...ok, status: "laeuft" }).success).toBe(false);
  expect(leasingFieldsSchema.safeParse({ ...ok, laufzeitMonate: 0 }).success).toBe(false);
});
test("call", () => {
  const ok = { richtung: "eingehend", nummer: "030 9100100", name: "Zentrum", zeitpunkt: new Date().toISOString(), dauerSek: 120, kategorie: "Auftrag", status: "offen" };
  expect(callFieldsSchema.safeParse(ok).success).toBe(true);
  expect(callFieldsSchema.safeParse({ ...ok, zeitpunkt: "2026-07-04T02:00:11.057+00:00" }).success).toBe(true);
  expect(callFieldsSchema.safeParse({ ...ok, zeitpunkt: "2026-07-04" }).success).toBe(false);
  expect(callFieldsSchema.safeParse({ ...ok, status: "fertig" }).success).toBe(false);
  expect(callFieldsSchema.safeParse({ ...ok, dauerSek: -1 }).success).toBe(false);
});
