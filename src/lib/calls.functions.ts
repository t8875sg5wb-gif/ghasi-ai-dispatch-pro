// Server functions for persisted calls (Anrufprotokoll). RLS enforces
// admin/disposition/fahrer read, admin/disposition write.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Anruf } from "@/lib/telefon";
import { rowToAnruf, anrufToRow, type CallRow, type CallWrite } from "@/lib/calls-shared";

/**
 * Strenge Laufzeitvalidierung für Anruf-Mutationen (Muster CP19/CP22/CP23).
 * Enums entsprechen `AnrufRichtung` / `AnrufKategorie` / `AnrufStatus`
 * (src/lib/telefon.ts).
 * `zeitpunkt`: ISO-8601 mit erlaubtem Offset – die Werte kommen entweder aus
 * `new Date().toISOString()` (…Z) oder beim Bearbeiten aus der DB-Spalte
 * `timestamptz` (…+00:00).
 */
export const callFieldsSchema = z
  .object({
    richtung: z.enum(["eingehend", "ausgehend", "verpasst", "voicemail"]),
    nummer: z.string().trim().min(1).max(50),
    name: z.string().trim().max(200).nullable().optional(),
    zeitpunkt: z.string().datetime({ offset: true }),
    dauerSek: z.number().int().min(0),
    kategorie: z.enum(["Auftrag", "Rückfrage", "Terminänderung", "Beschwerde", "Sonstige"]),
    status: z.enum(["offen", "rueckruf", "erledigt"]),
    notiz: z.string().max(2000).nullable().optional(),
    auftragErstellt: z.boolean().optional(),
  })
  .strict();

const createCallSchema = callFieldsSchema;

export const updateCallSchema = z
  .object({ id: z.string().uuid(), values: callFieldsSchema.partial().strict() })
  .strict()
  .refine((v) => Object.keys(v.values).length > 0, {
    message: "Keine Änderungen übergeben.",
    path: ["values"],
  });

const deleteCallSchema = z.object({ id: z.string().uuid() }).strict();

export const listCalls = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Anruf[]> => {
    const { data, error } = await context.supabase
      .from("calls")
      .select("*")
      .order("zeitpunkt", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToAnruf(r as unknown as CallRow));
  });

export const createCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): CallWrite => {
    const parsed = createCallSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Anrufdaten.");
    return parsed.data as unknown as CallWrite;
  })
  .handler(async ({ data, context }): Promise<Anruf> => {
    const { data: created, error } = await context.supabase
      .from("calls")
      .insert(anrufToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToAnruf(created as unknown as CallRow);
  });

export const updateCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: Partial<CallWrite> } => {
    const parsed = updateCallSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Anrufdaten.");
    return parsed.data as unknown as { id: string; values: Partial<CallWrite> };
  })
  .handler(async ({ data, context }): Promise<Anruf> => {
    const { data: updated, error } = await context.supabase
      .from("calls")
      .update(anrufToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToAnruf(updated as unknown as CallRow);
  });

export const deleteCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = deleteCallSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Anrufdaten.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("calls").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const seedCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("calls")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { INITIAL_ANRUFE } = await import("@/lib/telefon");
    const rows = INITIAL_ANRUFE.map((a) => {
      const { id: _id, ...rest } = a;
      void _id;
      return anrufToRow(rest);
    });
    const { error } = await context.supabase.from("calls").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
