import { expect, test } from "bun:test";
import { invoiceFieldsSchema } from "@/lib/invoices.functions";
import { rowToRechnung, rechnungToWrite, type InvoiceRow } from "@/lib/invoices-shared";

const rows = JSON.parse(await Bun.file("/tmp/inv/rows.json").text()) as InvoiceRow[];

test("alle Bestandsrechnungen passieren das neue Schema", () => {
  const fails: string[] = [];
  for (const r of rows) {
    const w = rechnungToWrite(rowToRechnung(r));
    const p = invoiceFieldsSchema.safeParse(w);
    if (!p.success) fails.push(`${r.nummer}: ${JSON.stringify(p.error.issues)}`);
  }
  console.log("geprüft:", rows.length, "Verstöße:", fails.length);
  for (const f of fails) console.log(f);
  expect(fails).toEqual([]);
});
