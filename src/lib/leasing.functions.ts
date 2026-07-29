// Server functions for persisted leasing contracts (Leasingverträge). RLS
// enforces admin/disposition/finanz read, admin/finanz write.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Leasingvertrag } from "@/lib/leasing";
import {
  rowToLeasing,
  leasingToRow,
  type LeasingRow,
  type LeasingWrite,
} from "@/lib/leasing-shared";

/**
 * Strenge Laufzeitvalidierung für Leasing-Mutationen (Muster CP19/CP22/CP23).
 * `status` entspricht `LeasingStatus` (src/lib/leasing.ts).
 * `fahrzeug` bleibt in diesem Checkpoint bewusst Freitext (Kennzeichen) –
 * eine FK-Umstellung auf `vehicles.id` ist ein eigenes Thema.
 */
export const leasingFieldsSchema = z
  .object({
    leasinggeber: z.string().trim().min(1).max(200),
    vertragsnummer: z.string().trim().min(1).max(100),
    fahrzeug: z.string().trim().min(1).max(200),
    rateMonat: z.number().min(0),
    beginn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein."),
    ende: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein."),
    restwert: z.number().min(0),
    laufzeitMonate: z.number().int().min(1),
    kmInklusive: z.number().min(0),
    kmAktuell: z.number().min(0),
    status: z.enum(["aktiv", "endet_bald", "beendet"]),
    notiz: z.string().max(2000).optional(),
  })
  .strict();

const createLeasingSchema = leasingFieldsSchema;

export const updateLeasingSchema = z
  .object({ id: z.string().uuid(), values: leasingFieldsSchema.partial().strict() })
  .strict()
  .refine((v) => Object.keys(v.values).length > 0, {
    message: "Keine Änderungen übergeben.",
    path: ["values"],
  });

const deleteLeasingSchema = z.object({ id: z.string().uuid() }).strict();

export const listLeasing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Leasingvertrag[]> => {
    const { data, error } = await context.supabase
      .from("leasing_contracts")
      .select("*")
      .order("ende", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToLeasing(r as unknown as LeasingRow));
  });

export const createLeasing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): LeasingWrite => {
    const parsed = createLeasingSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Leasingdaten.");
    return parsed.data as unknown as LeasingWrite;
  })
  .handler(async ({ data, context }): Promise<Leasingvertrag> => {
    const { data: created, error } = await context.supabase
      .from("leasing_contracts")
      .insert(leasingToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToLeasing(created as unknown as LeasingRow);
  });

export const updateLeasing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: Partial<LeasingWrite> } => {
    const parsed = updateLeasingSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Leasingdaten.");
    return parsed.data as unknown as { id: string; values: Partial<LeasingWrite> };
  })
  .handler(async ({ data, context }): Promise<Leasingvertrag> => {
    const { data: updated, error } = await context.supabase
      .from("leasing_contracts")
      .update(leasingToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToLeasing(updated as unknown as LeasingRow);
  });

export const deleteLeasing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = deleteLeasingSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Leasingdaten.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leasing_contracts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const seedLeasing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("leasing_contracts")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { INITIAL_LEASING } = await import("@/lib/leasing");
    const rows = INITIAL_LEASING.map((l) => {
      const { id: _id, ...rest } = l;
      void _id;
      return leasingToRow(rest);
    });
    const { error } = await context.supabase.from("leasing_contracts").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
