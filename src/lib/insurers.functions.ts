// Server functions for persisted insurers (Krankenkassen). RLS enforces
// admin/finanz access.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Krankenkasse } from "@/lib/stammdaten";
import {
  rowToKrankenkasse,
  krankenkasseToRow,
  type InsurerRow,
  type InsurerWrite,
} from "@/lib/insurers-shared";

/**
 * Strenge Laufzeitvalidierung für Kostenträger-Mutationen (Muster CP19/CP22/CP23).
 * ACHTUNG: `vertragsstatus` hat hier eine EIGENE Enum
 * ("Rahmenvertrag" | "Einzelfall", vgl. `Krankenkasse` in stammdaten.ts) und ist
 * NICHT identisch mit `Kunde.vertragsstatus` aus Checkpoint 23.
 */
export const insurerFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    kuerzel: z.string().trim().min(1).max(20),
    vertragsstatus: z.enum(["Rahmenvertrag", "Einzelfall"]),
  })
  .strict();

const createInsurerSchema = insurerFieldsSchema;

export const updateInsurerSchema = z
  .object({ id: z.string().uuid(), values: insurerFieldsSchema.partial().strict() })
  .strict()
  .refine((v) => Object.keys(v.values).length > 0, {
    message: "Keine Änderungen übergeben.",
    path: ["values"],
  });

const deleteInsurerSchema = z.object({ id: z.string().uuid() }).strict();


export const listInsurers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Krankenkasse[]> => {
    const { data, error } = await context.supabase
      .from("insurers")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToKrankenkasse(r as unknown as InsurerRow));
  });

export const createInsurer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): InsurerWrite => {
    const parsed = createInsurerSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Kostenträgerdaten.");
    return parsed.data as unknown as InsurerWrite;
  })
  .handler(async ({ data, context }): Promise<Krankenkasse> => {
    const { data: created, error } = await context.supabase
      .from("insurers")
      .insert(krankenkasseToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToKrankenkasse(created as unknown as InsurerRow);
  });

export const updateInsurer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: Partial<InsurerWrite> } => {
    const parsed = updateInsurerSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Kostenträgerdaten.");
    return parsed.data as unknown as { id: string; values: Partial<InsurerWrite> };
  })
  .handler(async ({ data, context }): Promise<Krankenkasse> => {
    const { data: updated, error } = await context.supabase
      .from("insurers")
      .update(krankenkasseToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToKrankenkasse(updated as unknown as InsurerRow);
  });

export const deleteInsurer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = deleteInsurerSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Kostenträgerdaten.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("insurers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const seedInsurers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("insurers")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { KRANKENKASSEN } = await import("@/lib/stammdaten");
    const rows = KRANKENKASSEN.map((k) => {
      const { id: _id, ...rest } = k;
      void _id;
      return krankenkasseToRow(rest);
    });
    const { error } = await context.supabase.from("insurers").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
