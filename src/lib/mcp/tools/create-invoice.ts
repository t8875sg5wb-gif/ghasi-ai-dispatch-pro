import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { autorisiere } from "../authz";
import {
  rowToRechnung,
  writeToInvoiceRow,
  type InvoiceRow,
  type InvoiceWrite,
} from "@/lib/invoices-shared";
import { requireBestaetigtenSteuerModus } from "@/lib/company-settings-shared";

const isoDatum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein.");

export default defineTool({
  name: "create_invoice",
  title: "Rechnung anlegen",
  description:
    "Legt eine Rechnung oder Gutschrift an. Beträge dürfen für Gutschriften negativ sein. Erfordert einen bestätigten Steuermodus in den Firmeneinstellungen.",
  inputSchema: {
    kunde: z.string().trim().min(1).max(200).describe("Name des Rechnungsempfängers (Pflicht)."),
    kundeId: z.string().max(100).optional().describe("Kunden-/Kostenträger-ID, falls bekannt."),
    typ: z.enum(["rechnung", "gutschrift"]).optional().describe("Standard: 'rechnung'."),
    abrechnungsart: z.enum(["Krankenkasse", "Patient", "Kunde"]).optional(),
    betrag: z.number().describe("Nettobetrag in Euro (negativ bei Gutschrift)."),
    mwstSatz: z.number().min(0).max(100).describe("USt-Satz in Prozent, z.B. 7."),
    status: z
      .enum(["entwurf", "offen", "bezahlt", "teilbezahlt", "ueberfaellig", "storniert"])
      .optional()
      .describe("Standard: 'entwurf'."),
    datum: isoDatum.describe("Rechnungsdatum (YYYY-MM-DD)."),
    faelligkeit: isoDatum.describe("Fälligkeitsdatum (YYYY-MM-DD)."),
    leistungsdatum: isoDatum.optional(),
    bezugAuftrag: z.string().trim().max(50).optional().describe("Auftragsnummer, z.B. 'A-2052'."),
    positionen: z
      .array(
        z
          .object({
            beschreibung: z.string().trim().min(1).max(300),
            menge: z.number(),
            einzelpreis: z.number(),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    notiz: z.string().max(5000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const gate = await autorisiere(ctx, "ghasi:invoices.write");
    if (!gate.ok) return gate.error;
    const supabase = gate.supabase;
    try {
      await requireBestaetigtenSteuerModus(supabase);

      const jahr = input.datum.slice(0, 4);
      const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true });
      const nummer = `${input.typ === "gutschrift" ? "GU" : "R"}-${jahr}-${String(
        (count ?? 0) + 1,
      ).padStart(4, "0")}`;

      const row = writeToInvoiceRow({
        ...(input as Partial<InvoiceWrite>),
        nummer,
        typ: input.typ ?? "rechnung",
        kundeId: input.kundeId ?? "",
        abrechnungsart: input.abrechnungsart ?? "Kunde",
        status: input.status ?? "entwurf",
      });
      const { data, error } = await supabase
        .from("invoices")
        .insert(row as never)
        .select()
        .single();
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      const rechnung = rowToRechnung(data as unknown as InvoiceRow);
      return {
        content: [{ type: "text", text: JSON.stringify(rechnung, null, 2) }],
        structuredContent: { invoice: rechnung },
      };
    } catch (e) {
      return {
        content: [
          { type: "text", text: e instanceof Error ? e.message : "Anlegen fehlgeschlagen." },
        ],
        isError: true,
      };
    }
  },
});
