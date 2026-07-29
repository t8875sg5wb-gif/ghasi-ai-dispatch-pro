import { expect, test } from "bun:test";
import { recurringFieldsSchema } from "@/lib/recurring.functions";
import { rowToDauerauftrag, dauerauftragToWrite, type RecurringRow } from "@/lib/recurring-shared";

const row = JSON.parse(process.env.CP25_ROW!) as RecurringRow;

test("Bestandszeile wird akzeptiert", () => {
  const w = dauerauftragToWrite(rowToDauerauftrag(row));
  const r = recurringFieldsSchema.safeParse(w);
  if (!r.success) console.log(JSON.stringify(r.error.issues, null, 2));
  expect(r.success).toBe(true);
});
test("Fremdfeld abgelehnt", () => {
  expect(recurringFieldsSchema.safeParse({ patient: "X", terminzeit: "08:00", foo: 1 }).success).toBe(false);
});
test("falsche Uhrzeit abgelehnt", () => {
  expect(recurringFieldsSchema.safeParse({ patient: "X", terminzeit: "8:00" }).success).toBe(false);
});
test("falsches Enum abgelehnt", () => {
  expect(recurringFieldsSchema.safeParse({ patient: "X", terminzeit: "08:00", rhythmus: "monatlich" }).success).toBe(false);
});
test("Wochentag 7 abgelehnt", () => {
  expect(recurringFieldsSchema.safeParse({ patient: "X", terminzeit: "08:00", wochentage: [7] }).success).toBe(false);
});
test("leerer Patient abgelehnt", () => {
  expect(recurringFieldsSchema.safeParse({ patient: "", terminzeit: "08:00" }).success).toBe(false);
});
