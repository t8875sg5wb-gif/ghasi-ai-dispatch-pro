// Server functions for persisted drivers (Fahrer).
// All run as the signed-in user (RLS enforces role-based access).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Fahrer } from "@/lib/fahrer";
import { rowToFahrer, writeToRow, type DriverRow, type DriverWrite } from "@/lib/drivers-shared";

/**
 * Strenge Laufzeitvalidierung für normale Fahrer-Mutationen.
 * `.strict()` weist unbekannte Felder ab — insbesondere `userId`/`user_id`:
 * Die Kontoverknüpfung läuft ausschließlich über `setDriverAccountLink`
 * und ist zusätzlich per DB-Trigger auf Admins beschränkt.
 */
const nachweisSchema = z
  .object({ gueltigBis: z.string(), info: z.string().optional() })
  .strict();

const driverFieldsSchema = z
  .object({
    nummer: z.string().optional(),
    name: z.string().min(1),
    foto: z.string().nullable(),
    telefon: z.string(),
    email: z.string(),
    adresse: z.string(),
    fuehrerschein: nachweisSchema,
    pSchein: nachweisSchema,
    ersteHilfe: nachweisSchema,
    vertragsart: z.string(),
    arbeitszeiten: z.string(),
    urlaubstage: z.number(),
    krankheitstage: z.number(),
    status: z.string(),
    standort: z.string(),
    gps: z.object({ lat: z.number(), lng: z.number() }),
    fahrzeug: z.string().nullable(),
    schicht: z.string(),
    bewertung: z.number(),
    puenktlichkeit: z.number(),
    beschwerden: z.number(),
    lob: z.number(),
    ueberstunden: z.number(),
    kmHeute: z.number(),
    umsatzHeute: z.number(),
    gewinnHeute: z.number(),
    pScheinGueltigBis: z.string().nullable().optional(),
    fuehrungszeugnisDatum: z.string().nullable().optional(),
    svAusweisVorhanden: z.boolean().optional(),
    steuerId: z.string().optional(),
    beschaeftigungsart: z.string().optional(),
    monatsbrutto: z.number().optional(),
  })
  .strict();

const createDriverSchema = driverFieldsSchema;
const updateDriverSchema = z
  .object({ id: z.string().uuid(), values: driverFieldsSchema.partial().strict() })
  .strict();

export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Fahrer[]> => {
    const { data, error } = await context.supabase
      .from("drivers")
      .select("*")
      .order("nummer", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToFahrer(r as unknown as DriverRow));
  });

export const createDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): DriverWrite => {
    const parsed = createDriverSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Fahrerdaten.");
    return parsed.data as unknown as DriverWrite;
  })
  .handler(async ({ data, context }): Promise<Fahrer> => {
    let nummer = data.nummer;
    if (!nummer) {
      const { count } = await context.supabase
        .from("drivers")
        .select("*", { count: "exact", head: true });
      nummer = `F-${String((count ?? 0) + 1).padStart(3, "0")}`;
    }
    const row = writeToRow({ ...data, nummer });
    const { data: created, error } = await context.supabase
      .from("drivers")
      .insert(row as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToFahrer(created as unknown as DriverRow);
  });

export const updateDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: Partial<DriverWrite> } => {
    const parsed = updateDriverSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Fahrerdaten.");
    return parsed.data as unknown as { id: string; values: Partial<DriverWrite> };
  })
  .handler(async ({ data, context }): Promise<Fahrer> => {
    const row = writeToRow(data.values);
    const { data: updated, error } = await context.supabase
      .from("drivers")
      .update(row as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToFahrer(updated as unknown as DriverRow);
  });

export const deleteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Fahrer-ID.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("drivers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * One-time seed: fills the drivers table with the original demo set if it is
 * empty. Admin/Disposition only (enforced by RLS on INSERT). Idempotent.
 */
export const seedDrivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("drivers")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };

    const { SEED_FAHRER } = await import("@/lib/fahrer");
    const rows = SEED_FAHRER.map((f: Fahrer) =>
      writeToRow({
        nummer: f.nummer,
        name: f.name,
        foto: f.foto,
        telefon: f.telefon,
        email: f.email,
        adresse: f.adresse,
        fuehrerschein: f.fuehrerschein,
        pSchein: f.pSchein,
        ersteHilfe: f.ersteHilfe,
        vertragsart: f.vertragsart,
        arbeitszeiten: f.arbeitszeiten,
        urlaubstage: f.urlaubstage,
        krankheitstage: f.krankheitstage,
        status: f.status,
        standort: f.standort,
        gps: f.gps,
        fahrzeug: f.fahrzeug,
        schicht: f.schicht,
        bewertung: f.bewertung,
        puenktlichkeit: f.puenktlichkeit,
        beschwerden: f.beschwerden,
        lob: f.lob,
        ueberstunden: f.ueberstunden,
        kmHeute: f.kmHeute,
        umsatzHeute: f.umsatzHeute,
        gewinnHeute: f.gewinnHeute,
      }),
    );
    if (rows.length === 0) return { seeded: 0 };
    const { error } = await context.supabase.from("drivers").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });

/* ------------------------------------------------------------------ *
 * Admin-only: Fahrer ↔ Auth-Konto verknüpfen / trennen
 * ------------------------------------------------------------------ */

const linkSchema = z
  .object({ driverId: z.string().uuid(), userId: z.string().uuid().nullable() })
  .strict();

export interface DriverAccountLinkResult {
  driverId: string;
  userId: string | null;
}

/**
 * Einzige erlaubte Schreiboperation auf `drivers.user_id`.
 * Prüft die Admin-Rolle serverseitig über die kanonische `user_roles`-Tabelle
 * (nie über clientseitige Angaben) und gibt niemals rohe DB-Fehler zurück.
 */
export const setDriverAccountLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { driverId: string; userId: string | null } => {
    const parsed = linkSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Eingabe für die Kontoverknüpfung.");
    return parsed.data;
  })
  .handler(async ({ data, context }): Promise<DriverAccountLinkResult> => {
    // 1) Aufrufer muss echter Admin sein (kanonische Rollentabelle).
    const { data: adminRolle } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRolle) {
      throw new Error("Kein Zugriff: Diese Aktion ist Administratoren vorbehalten.");
    }

    // 2) Fahrerdatensatz muss existieren.
    const { data: driver } = await context.supabase
      .from("drivers")
      .select("id")
      .eq("id", data.driverId)
      .maybeSingle();
    if (!driver) throw new Error("Fahrerdatensatz nicht gefunden.");

    if (data.userId) {
      // 3) Konto muss existieren …
      const { data: profil } = await context.supabase
        .from("profiles")
        .select("id")
        .eq("id", data.userId)
        .maybeSingle();
      if (!profil) throw new Error("Benutzerkonto nicht gefunden.");

      // 4) … und die Rolle „fahrer“ besitzen.
      const { data: fahrerRolle } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.userId)
        .eq("role", "fahrer")
        .maybeSingle();
      if (!fahrerRolle) {
        throw new Error("Das Konto besitzt nicht die Rolle „Fahrer“ und kann nicht verknüpft werden.");
      }

      // 5) Ein Konto darf nur zu einem Fahrer gehören (zusätzlich DB-unique).
      const { data: belegt } = await context.supabase
        .from("drivers")
        .select("id")
        .eq("user_id", data.userId)
        .neq("id", data.driverId)
        .maybeSingle();
      if (belegt) throw new Error("Dieses Konto ist bereits mit einem anderen Fahrer verknüpft.");
    }

    const { error } = await context.supabase
      .from("drivers")
      .update({ user_id: data.userId } as never)
      .eq("id", data.driverId);
    if (error) {
      // Keine rohen SQL-/Supabase-Details an den Browser.
      throw new Error("Die Kontoverknüpfung konnte nicht gespeichert werden.");
    }

    return { driverId: data.driverId, userId: data.userId };
  });
