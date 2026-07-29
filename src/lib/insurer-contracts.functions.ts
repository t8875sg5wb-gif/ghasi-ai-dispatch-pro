// Server functions for insurer contracts (RLS: admin/finanz).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertInsurerExists } from "@/lib/identity-checks.server";
import {
  rowToKassenvertrag,
  kassenvertragToRow,
  type Kassenvertrag,
  type KassenvertragRow,
  type KassenvertragWrite,
} from "@/lib/insurer-contracts-shared";

/**
 * Strenge Laufzeitvalidierung für Kassenvertrags-Mutationen (Muster CP19/CP22/CP23).
 * `einheit`-Werte stammen aus `VERTRAG_EINHEITEN` (insurer-contracts-shared.ts).
 * `insurerId` ist Teil der Identitätskette und wird zusätzlich per
 * `assertInsurerExists` gegen `public.insurers` geprüft.
 */
export const insurerContractFieldsSchema = z
  .object({
    insurerId: z.string().uuid(),
    leistung: z.string().trim().min(1).max(200),
    preis: z.number().min(0),
    einheit: z.enum(["pro Fahrt", "pro km", "pro Std.", "Pauschale"]),
    genehmigt: z.boolean(),
    gueltigAb: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein.")
      .nullable()
      .optional(),
    gueltigBis: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein.")
      .nullable()
      .optional(),
    aktenzeichen: z.string().trim().max(100).optional(),
    notiz: z.string().max(2000).optional(),
  })
  .strict();

const createInsurerContractSchema = insurerContractFieldsSchema;

const deleteInsurerContractSchema = z.object({ id: z.string().uuid() }).strict();

export const listInsurerContracts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Kassenvertrag[]> => {
    const { data, error } = await context.supabase
      .from("insurer_contracts")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToKassenvertrag(r as unknown as KassenvertragRow));
  });

export const createInsurerContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): KassenvertragWrite => {
    const parsed = createInsurerContractSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Kassenvertragsdaten.");
    return parsed.data as unknown as KassenvertragWrite;
  })
  .handler(async ({ data, context }): Promise<Kassenvertrag> => {
    await assertInsurerExists(context.supabase, data.insurerId);
    const { data: created, error } = await context.supabase
      .from("insurer_contracts")
      .insert(kassenvertragToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToKassenvertrag(created as unknown as KassenvertragRow);
  });

export const deleteInsurerContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = deleteInsurerContractSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Kassenvertragsdaten.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("insurer_contracts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });
