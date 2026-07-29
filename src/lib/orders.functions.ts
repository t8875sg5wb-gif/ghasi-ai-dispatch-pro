// Server functions for persisted transport orders (Aufträge).
// All run as the signed-in user (RLS enforces role-based access).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Auftrag } from "@/lib/auftraege";
import { assertInsurerExists, assertPatientExists } from "@/lib/identity-checks.server";
import {
  rowToAuftrag,
  writeToRow,
  type AuftragMitWarnungen,
  type OrderRow,
  type OrderWrite,
} from "@/lib/orders-shared";

/**
 * Strenge Laufzeitvalidierung für Auftragsmutationen.
 * `.strict()` weist unbekannte Felder aktiv ab — insbesondere `fahrer`
 * (Anzeigename) und `fahrer_user_id`/`fahrerUserId`: Diese Werte werden
 * ausschließlich serverseitig per DB-Trigger aus `fahrerId` abgeleitet und
 * dürfen niemals vom Browser gesetzt werden.
 */
const adresseSchema = z
  .object({
    street: z.string().optional(),
    houseNumber: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    additionalInfo: z.string().optional(),
  })
  .strict();

/** Zeitstempel & Nachweis-Metadaten; bewusst eng begrenzt. */
const lifecycleSchema = z
  .object({
    gestartetAm: z.string().max(40).optional(),
    angekommenAm: z.string().max(40).optional(),
    abgeschlossenAm: z.string().max(40).optional(),
    unterschriftAm: z.string().max(40).optional(),
    unterschriftVerweigert: z.boolean().optional(),
    unterschriftVerweigertGrund: z.string().max(500).optional(),
  })
  .strict();

/**
 * Patientenunterschrift: PNG-Data-URL mit harter Längenbegrenzung (~150 KB),
 * damit keine großen Bilder in der Auftragszeile landen.
 */
const unterschriftSchema = z
  .string()
  .max(200_000)
  .regex(/^data:image\/png;base64,/, "Unterschrift muss eine PNG-Data-URL sein.")
  .nullable();

export const orderFieldsSchema = z
  .object({
    nummer: z.string().max(50).optional(),
    patient: z.string().trim().max(200).optional(),
    patientId: z.string().uuid().nullable().optional(),
    insurerId: z.string().uuid().nullable().optional(),
    verordnungId: z.string().uuid().nullable().optional(),
    telefon: z.string().trim().max(50).optional(),
    transportart: z
      .enum(["Liegendtransport", "Sitzendtransport", "Rollstuhl", "Dialysefahrt"])
      .optional(),
    prioritaet: z.enum(["niedrig", "normal", "hoch", "dringend"]).optional(),
    status: z.enum(["neu", "disponiert", "unterwegs", "abgeschlossen", "storniert"]).optional(),
    abholort: z.string().trim().max(300).optional(),
    zielort: z.string().trim().max(300).optional(),
    pickup: adresseSchema.optional(),
    destination: adresseSchema.optional(),
    termin: z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
        "Termin muss ISO-Datum/Zeit sein (YYYY-MM-DDTHH:mm).",
      )
      .optional(),
    fahrerId: z.string().uuid().nullable().optional(),
    fahrzeug: z.string().nullable().optional(),
    kostentraeger: z.string().trim().max(200).optional(),
    notiz: z.string().max(2000).optional(),
    verordnung: z.string().trim().max(200).optional(),
    verordnungDokumentId: z.string().nullable().optional(),
    mobilitaet: z.string().trim().max(200).nullable().optional(),
    begleitperson: z.boolean().optional(),
    abholanforderung: z.string().max(500).optional(),
    zielanforderung: z.string().max(500).optional(),
    patientennotiz: z.string().max(2000).optional(),
    medizinischeNotiz: z.string().max(2000).optional(),
    detailStatus: z.string().nullable().optional(),
    abrechnungStatus: z.string().optional(),
    dauerauftragId: z.string().nullable().optional(),
    unterschrift: unterschriftSchema.optional(),
    lifecycle: lifecycleSchema.optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  })
  .strict();

export const createOrderSchema = orderFieldsSchema
  .extend({ patient: z.string().trim().min(1).max(200) })
  .strict();
export const updateOrderSchema = z
  .object({ id: z.string().uuid(), values: orderFieldsSchema })
  .strict()
  .refine((v) => Object.keys(v.values).length > 0, {
    message: "Keine Änderungen übergeben.",
    path: ["values"],
  });


/**
 * Identitätskette: Eine Fahrerzuordnung wird ausschließlich über die stabile
 * `drivers.id` gesetzt. Es gibt bewusst KEINEN Namensabgleich mehr.
 * Anzeigename und `fahrer_user_id` werden vom DB-Trigger
 * `enforce_order_assignment` aus dem Fahrerdatensatz abgeleitet.
 */
async function assertDriverExists(
  supabase: SupabaseClient<Database>,
  fahrerId: string,
): Promise<void> {
  const { data } = await supabase.from("drivers").select("id").eq("id", fahrerId).maybeSingle();
  if (!data) throw new Error("Unbekannter Fahrer – Zuordnung nicht möglich.");
}

// Existenzprüfungen für Patient/Kostenträger liegen zentral in
// `identity-checks.server.ts` (auch von Daueraufträgen genutzt).

/**
 * Eine Verordnung darf nur an einen Auftrag desselben Patienten gehängt
 * werden. Ohne verknüpften Patienten gibt es keine belastbare Zuordnung –
 * dann wird bewusst abgelehnt statt geraten.
 */
async function assertVerordnungPasstZuPatient(
  supabase: SupabaseClient<Database>,
  verordnungId: string,
  patientId: string | null | undefined,
): Promise<void> {
  const { data } = await supabase
    .from("verordnungen")
    .select("id, patient_id")
    .eq("id", verordnungId)
    .maybeSingle();
  if (!data) throw new Error("Unbekannte Verordnung – Verknüpfung nicht möglich.");
  if (!patientId)
    throw new Error(
      "Verordnung kann nur mit einem aus den Stammdaten verknüpften Patienten gespeichert werden.",
    );
  if ((data as { patient_id: string | null }).patient_id !== patientId)
    throw new Error("Die Verordnung gehört zu einem anderen Patienten.");
}




export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Auftrag[]> => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("*")
      .order("termin", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToAuftrag(r as unknown as OrderRow));
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): OrderWrite => {
    const parsed = createOrderSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Auftragsdaten.");
    return parsed.data as OrderWrite;
  })
  .handler(async ({ data, context }): Promise<AuftragMitWarnungen> => {
    let nummer = data.nummer;
    if (!nummer) {
      const { count } = await context.supabase
        .from("orders")
        .select("*", { count: "exact", head: true });
      nummer = `A-${2045 + (count ?? 0)}`;
    }
    if (data.fahrerId) await assertDriverExists(context.supabase, data.fahrerId);
    if (data.patientId) await assertPatientExists(context.supabase, data.patientId);
    if (data.insurerId) await assertInsurerExists(context.supabase, data.insurerId);
    if (data.verordnungId)
      await assertVerordnungPasstZuPatient(context.supabase, data.verordnungId, data.patientId);

    const row = writeToRow({ ...data, nummer, status: data.status ?? "neu" });
    const { data: created, error } = await context.supabase
      .from("orders")
      .insert(row as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const auftrag: AuftragMitWarnungen = rowToAuftrag(created as unknown as OrderRow);

    // Zuweisungskonflikte: warnen, nicht blockieren. Nur wenn tatsächlich
    // ein Fahrer oder Fahrzeug zugewiesen wurde.
    if (auftrag.fahrerId || auftrag.fahrzeug) {
      const { berechneZuweisungsWarnungen } = await import("@/lib/assignment-conflicts.server");
      const warnungen = await berechneZuweisungsWarnungen(context.supabase, auftrag.id);
      if (warnungen.length > 0) auftrag.zuweisungsWarnungen = warnungen;
    }
    return auftrag;
  });


export const updateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: Partial<OrderWrite> } => {
    const parsed = updateOrderSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Auftragsdaten.");
    return parsed.data as { id: string; values: Partial<OrderWrite> };
  })
  .handler(async ({ data, context }): Promise<AuftragMitWarnungen> => {
    if (data.values.fahrerId) await assertDriverExists(context.supabase, data.values.fahrerId);
    if (data.values.patientId) await assertPatientExists(context.supabase, data.values.patientId);
    if (data.values.insurerId) await assertInsurerExists(context.supabase, data.values.insurerId);
    // Verordnung/Patient müssen auch nach einem Teil-Update zueinander passen.
    const aendertVerordnung = "verordnungId" in data.values;
    const aendertPatient = "patientId" in data.values;
    if (aendertVerordnung || aendertPatient) {
      const { data: bestand } = await context.supabase
        .from("orders")
        .select("patient_id, verordnung_id")
        .eq("id", data.id)
        .maybeSingle();
      const alt = (bestand ?? {}) as { patient_id?: string | null; verordnung_id?: string | null };
      const patientId = aendertPatient ? data.values.patientId : (alt.patient_id ?? null);
      const verordnungId = aendertVerordnung
        ? data.values.verordnungId
        : (alt.verordnung_id ?? null);
      if (verordnungId)
        await assertVerordnungPasstZuPatient(context.supabase, verordnungId, patientId);
    }

    const row = writeToRow(data.values);
    const { data: updated, error } = await context.supabase
      .from("orders")
      .update(row as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const auftrag: AuftragMitWarnungen = rowToAuftrag(updated as unknown as OrderRow);

    // Zuweisungskonflikte nur berechnen, wenn dieses Schreiben Fahrer oder
    // Fahrzeug angefasst hat und am Ende auch eines von beiden gesetzt ist.
    const aendertZuweisung = "fahrerId" in data.values || "fahrzeug" in data.values;
    if (aendertZuweisung && (auftrag.fahrerId || auftrag.fahrzeug)) {
      const { berechneZuweisungsWarnungen } = await import("@/lib/assignment-conflicts.server");
      const warnungen = await berechneZuweisungsWarnungen(context.supabase, auftrag.id);
      if (warnungen.length > 0) auftrag.zuweisungsWarnungen = warnungen;
    }


    // Audit trail: persist every status / dispatch-assignment / driver change with
    // timestamp, status, driver, vehicle and GPS position (when available).
    const v = data.values as Record<string, unknown>;
    const relevant = ["status", "detail_status", "fahrerId", "fahrzeug", "lat", "lng"].some(
      (k) => k in v,
    );
    if (relevant) {
      const gps =
        typeof v.lat === "number" && typeof v.lng === "number" ? { lat: v.lat, lng: v.lng } : null;
      // Nebenwirkung: Schreiben läuft über die Service-Rolle (gemeinsamer Helfer);
      // ein Protokollfehler darf den bereits gespeicherten Auftrag nicht kippen.
      const { logActivitySafe } = await import("@/lib/activity-log.server");
      await logActivitySafe(
        {
          bereich: "auftraege",
          entitaet: auftrag.id,
          aktion: "status_update",
          beschreibung: `Auftrag ${auftrag.nummer ?? auftrag.id}: Status ${auftrag.status}${
            auftrag.fahrer ? `, Fahrer ${auftrag.fahrer}` : ""
          }${auftrag.fahrzeug ? `, Fahrzeug ${auftrag.fahrzeug}` : ""}`,
          metadaten: {
            status: auftrag.status,
            detailStatus: auftrag.detailStatus ?? null,
            fahrer: auftrag.fahrer ?? null,
            fahrzeug: auftrag.fahrzeug ?? null,
            gps,
            zeitpunkt: new Date().toISOString(),
          },
        },
        context.userId,
      );
    }

    return auftrag;
  });

export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Auftrags-ID.");
    return parsed.data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * One-time seed: fills the orders table with the original demo set if it is
 * empty. Admin/Disposition only (enforced by RLS on INSERT). Idempotent: does
 * nothing once any orders exist.
 */
export const seedOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("orders")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };

    const { SEED_AUFTRAEGE } = await import("@/lib/auftraege");
    const rows = SEED_AUFTRAEGE.map((a: Auftrag) =>
      writeToRow({
        nummer: a.nummer,
        patient: a.patient,
        transportart: a.transportart,
        prioritaet: a.prioritaet,
        status: a.status,
        abholort: a.abholort,
        zielort: a.zielort,
        termin: a.termin,
        fahrzeug: a.fahrzeug,
        kostentraeger: a.kostentraeger,
        notiz: a.notiz,
        verordnung: a.verordnung,
        verordnungDokumentId: a.verordnungDokumentId ?? null,
        mobilitaet: a.mobilitaet ?? null,
        begleitperson: a.begleitperson ?? false,
        abholanforderung: a.abholanforderung ?? "",
        zielanforderung: a.zielanforderung ?? "",
        patientennotiz: a.patientennotiz ?? "",
        medizinischeNotiz: a.medizinischeNotiz ?? "",
      }),
    );
    if (rows.length === 0) return { seeded: 0 };
    const { error } = await context.supabase.from("orders").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
