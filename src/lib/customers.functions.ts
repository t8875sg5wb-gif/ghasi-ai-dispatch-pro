// Server functions for persisted customers (Kunden).
// All run as the signed-in user (RLS enforces finance/admin access).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Kunde } from "@/lib/stammdaten";
import {
  rowToKunde,
  kundeToRow,
  type CustomerRow,
  type CustomerWrite,
} from "@/lib/customers-shared";

/**
 * Strenge Laufzeitvalidierung für Kunden-Mutationen (Muster CP12/CP19/CP22).
 * `.strict()` weist unbekannte Felder ab.
 *
 * `vertragsstatus`: die Werte stammen aus `Kunde["vertragsstatus"]`
 * ("Rahmenvertrag" | "Einzelvertrag" | "Kein Vertrag", vgl. `VERTRAGS_STATI`).
 * "Einzelfall" gehört zum separaten Typ `Krankenkasse`, nicht zu `Kunde`.
 * Feld ist hier `.optional()`, weil `rowToKunde` es faktisch als optional
 * behandelt (Altbestand ohne Vertragsangabe).
 */
export const customerFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    typ: z.enum(["Krankenkasse", "Klinik", "Pflegeeinrichtung", "Privat", "Sonstige"]),
    ansprechpartner: z.string().trim().max(200),
    telefon: z.string().trim().max(50),
    offeneRechnungen: z.number().min(0),
    email: z.string().trim().max(200).email("Ungültige E-Mail-Adresse.").optional(),
    adresse: z.string().trim().max(300).optional(),
    vertragsstatus: z.enum(["Rahmenvertrag", "Einzelvertrag", "Kein Vertrag"]).optional(),
    konditionen: z.string().max(500).optional(),
    zahlungszielTage: z.number().int().min(0).max(365).optional(),
    kreditlimit: z.number().min(0).optional(),
    umsatzJahr: z.number().min(0).optional(),
    notiz: z.string().max(2000).optional(),
    aktiv: z.boolean().optional(),
    // Strukturierte Adressfelder für den XRechnung-Export (EN 16931).
    adresseStrasse: z.string().trim().max(200).optional(),
    adresseHausnummer: z.string().trim().max(20).optional(),
    adressePlz: z.string().trim().max(10).optional(),
    adresseOrt: z.string().trim().max(120).optional(),
    adresseLand: z.string().trim().max(2).optional(),
    /** Leitweg-ID: darf leer bleiben, wird im Export-Dialog angemahnt. */
    leitwegId: z.string().trim().max(60).optional(),
  })
  .strict();

const createCustomerSchema = customerFieldsSchema;

export const updateCustomerSchema = z
  .object({ id: z.string().uuid(), values: customerFieldsSchema.partial().strict() })
  .strict()
  .refine((v) => Object.keys(v.values).length > 0, {
    message: "Keine Änderungen übergeben.",
    path: ["values"],
  });

const deleteCustomerSchema = z.object({ id: z.string().uuid() }).strict();

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Kunde[]> => {
    const { data, error } = await context.supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToKunde(r as unknown as CustomerRow));
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): CustomerWrite => {
    const parsed = createCustomerSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Kundendaten.");
    return parsed.data as unknown as CustomerWrite;
  })
  .handler(async ({ data, context }): Promise<Kunde> => {
    const { data: created, error } = await context.supabase
      .from("customers")
      .insert(kundeToRow(data) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToKunde(created as unknown as CustomerRow);
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: Partial<CustomerWrite> } => {
    const parsed = updateCustomerSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Kundendaten.");
    return parsed.data as unknown as { id: string; values: Partial<CustomerWrite> };
  })
  .handler(async ({ data, context }): Promise<Kunde> => {
    const { data: updated, error } = await context.supabase
      .from("customers")
      .update(kundeToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToKunde(updated as unknown as CustomerRow);
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = deleteCustomerSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Kundendaten.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const seedCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("customers")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { KUNDEN } = await import("@/lib/stammdaten");
    const rows = KUNDEN.map((k) => {
      const { id: _id, ...rest } = k;
      void _id;
      return kundeToRow(rest);
    });
    const { error } = await context.supabase.from("customers").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
