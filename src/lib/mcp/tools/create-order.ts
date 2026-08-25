import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { autorisiere } from "../authz";
import { rowToAuftrag, writeToRow, type OrderRow, type OrderWrite } from "@/lib/orders-shared";
import {
  assertDriverExists,
  assertInsurerExists,
  assertPatientExists,
  assertVehicleExists,
} from "@/lib/identity-checks.server";

const adresse = z
  .object({
    street: z.string().optional(),
    houseNumber: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    additionalInfo: z.string().optional(),
  })
  .strict();

export default defineTool({
  name: "create_order",
  title: "Auftrag anlegen",
  description:
    "Legt einen neuen Krankentransport-Auftrag an. Zuordnungen (Patient, Kostenträger, Fahrer, Fahrzeug) nur über IDs; Anzeigenamen werden serverseitig abgeleitet.",
  inputSchema: {
    patient: z.string().trim().min(1).max(200).describe("Patientenname (Pflicht)."),
    patientId: z.string().uuid().optional().describe("UUID des Patienten-Stammdatensatzes."),
    insurerId: z.string().uuid().optional().describe("UUID des Kostenträgers."),
    telefon: z.string().trim().max(50).optional(),
    transportart: z
      .enum(["Liegendtransport", "Sitzendtransport", "Rollstuhl", "Dialysefahrt"])
      .optional(),
    prioritaet: z.enum(["niedrig", "normal", "hoch", "dringend"]).optional(),
    termin: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
        "Termin muss ISO-Datum/Zeit sein (YYYY-MM-DDTHH:mm).",
      )
      .optional(),
    abholort: z.string().trim().max(300).optional(),
    zielort: z.string().trim().max(300).optional(),
    pickup: adresse.optional(),
    destination: adresse.optional(),
    mobilitaet: z.string().trim().max(200).optional(),
    begleitperson: z.boolean().optional(),
    fahrerId: z.string().uuid().optional(),
    fahrzeugId: z.string().uuid().optional(),
    notiz: z.string().max(2000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  handler: async (input, ctx) => {
    const gate = await autorisiere(ctx, "ghasi:orders.write");
    if (!gate.ok) return gate.error;
    const supabase = gate.supabase;
    try {
      if (input.fahrerId) await assertDriverExists(supabase, input.fahrerId);
      if (input.fahrzeugId) await assertVehicleExists(supabase, input.fahrzeugId);
      if (input.patientId) await assertPatientExists(supabase, input.patientId);
      if (input.insurerId) await assertInsurerExists(supabase, input.insurerId);

      const { count } = await supabase.from("orders").select("*", { count: "exact", head: true });
      const row = writeToRow({
        ...(input as Partial<OrderWrite>),
        nummer: `A-${2045 + (count ?? 0)}`,
        status: "neu",
      });
      const { data, error } = await supabase
        .from("orders")
        .insert(row as never)
        .select()
        .single();
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      const auftrag = rowToAuftrag(data as unknown as OrderRow);
      return {
        content: [{ type: "text", text: JSON.stringify(auftrag, null, 2) }],
        structuredContent: { order: auftrag },
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
