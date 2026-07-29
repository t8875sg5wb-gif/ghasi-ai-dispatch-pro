// Server functions for persisted vehicles (Fahrzeuge).
// All run as the signed-in user (RLS enforces role-based access).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Fahrzeug } from "@/lib/fahrzeuge";
import {
  rowToFahrzeug,
  fahrzeugToRow,
  type VehicleRow,
  type VehicleWrite,
} from "@/lib/vehicles-shared";

/**
 * Strenge Laufzeitvalidierung für Fahrzeug-Mutationen (Muster wie CP12/CP13).
 * `.strict()` weist unbekannte Felder ab.
 */
/** ISO-Datum `YYYY-MM-DD`; leerer String erlaubt (Bestandsdaten ohne Frist). */
const isoDatumOderLeer = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-DD sein.")
  .or(z.literal(""));

export const vehicleFieldsSchema = z
  .object({
    nummer: z.string().optional(),
    kennzeichen: z.string().trim().min(1).max(20),
    // Bewusst ohne `.min(1)`: Bestandsdaten und CSV-Import enthalten leere Werte.
    marke: z.string().trim().max(100),
    modell: z.string().trim().max(100),
    baujahr: z.number().int().min(1990).max(2027),
    typ: z.enum(["PKW", "Rollstuhlfahrzeug", "LMW"]),
    rollstuhlGeeignet: z.boolean(),
    liegendGeeignet: z.boolean(),
    sitzplaetze: z.number().int().min(1).max(20),
    status: z.enum(["frei", "unterwegs", "werkstatt", "nicht_verfuegbar"]),
    fahrer: z.string().trim().max(200).nullable(),
    standort: z.string().trim().max(200),
    gps: z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
    kilometerstand: z.number().min(0),
    tankstand: z.number().min(0).max(100),
    kraftstoff: z.enum(["Diesel", "Benzin", "Elektro", "Hybrid"]),
    verbrauch: z.number().min(0),
    reichweite: z.number().min(0),
    kostenProKm: z.number().min(0),
    tagesumsatz: z.number().min(0),
    // Bewusst ohne `.min(0)`: ein Verlusttag ist betriebswirtschaftlich real.
    tagesgewinn: z.number(),
    monatsumsatz: z.number().min(0),
    monatsgewinn: z.number(),
    tuevBis: isoDatumOderLeer,
    oelwechselBei: z.number().min(0),
    naechsteWartung: isoDatumOderLeer,
    reifenstatus: z.enum(["gut", "mittel", "wechseln"]),
    reparaturen: z
      .array(
        z
          .object({
            datum: z.string(),
            beschreibung: z.string().max(500),
            kosten: z.number().min(0),
          })
          .strict(),
      )
      .optional(),
    versicherung: z.string().trim().max(200),
    versicherungBis: isoDatumOderLeer,
    leasingrate: z.number().min(0),
    leasingEnde: isoDatumOderLeer,
    dokumente: z.array(z.string()).optional(),
    fotos: z.array(z.string()).optional(),
    notizen: z.string().max(2000),
  })
  .strict();

const createVehicleSchema = vehicleFieldsSchema;
export const updateVehicleSchema = z
  .object({ id: z.string().uuid(), values: vehicleFieldsSchema.partial().strict() })
  .strict()
  .refine((v) => Object.keys(v.values).length > 0, {
    message: "Keine Änderungen übergeben.",
    path: ["values"],
  });

const deleteVehicleSchema = z.object({ id: z.string().uuid() }).strict();

export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Fahrzeug[]> => {
    const { data, error } = await context.supabase
      .from("vehicles")
      .select("*")
      .order("nummer", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToFahrzeug(r as unknown as VehicleRow));
  });

export const createVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): VehicleWrite => {
    const parsed = createVehicleSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Fahrzeugdaten.");
    return parsed.data as unknown as VehicleWrite;
  })
  .handler(async ({ data, context }): Promise<Fahrzeug> => {
    let nummer = data.nummer;
    if (!nummer) {
      const { count } = await context.supabase
        .from("vehicles")
        .select("*", { count: "exact", head: true });
      nummer = `KFZ-${String((count ?? 0) + 1).padStart(3, "0")}`;
    }
    const { data: created, error } = await context.supabase
      .from("vehicles")
      .insert(fahrzeugToRow({ ...data, nummer }) as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToFahrzeug(created as unknown as VehicleRow);
  });

export const updateVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: Partial<VehicleWrite> } => {
    const parsed = updateVehicleSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Fahrzeugdaten.");
    return parsed.data as unknown as { id: string; values: Partial<VehicleWrite> };
  })
  .handler(async ({ data, context }): Promise<Fahrzeug> => {
    const { data: updated, error } = await context.supabase
      .from("vehicles")
      .update(fahrzeugToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToFahrzeug(updated as unknown as VehicleRow);
  });

export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = deleteVehicleSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Fahrzeugdaten.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vehicles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });

export const seedVehicles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("vehicles")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { INITIAL_FAHRZEUGE } = await import("@/lib/fahrzeuge");
    const rows = INITIAL_FAHRZEUGE.map((f) => {
      const { id: _id, ...rest } = f;
      void _id;
      return fahrzeugToRow(rest);
    });
    const { error } = await context.supabase.from("vehicles").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
