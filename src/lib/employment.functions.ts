// Serverfunktionen für Beschäftigungsverhältnisse (Finanzbereich).
//
// SICHERHEIT:
// - Alle Funktionen laufen als angemeldeter Benutzer; RLS + DB-Trigger
//   beschränken Lesen und Schreiben auf die Rollen admin/finanz.
// - Zusätzlich wird die Rolle serverseitig geprüft (defense in depth).
// - Status, Version, Ersteller, Prüfer und Zeitstempel setzt ausschließlich
//   die Datenbank; Client-Werte werden nie übernommen.
// - Es wird kein Betrag geraten oder vorbelegt.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertDriverExists } from "@/lib/identity-checks.server";
import { assertFinanzRolle } from "@/lib/employment-security.server";
import {
  beschaeftigungToRow,
  createEmploymentSchema,
  employmentIdSchema,
  mapEmploymentDbError,
  rowToAudit,
  rowToBeschaeftigung,
  updateEmploymentSchema,
  type Beschaeftigungsverhaeltnis,
  type BeschaeftigungsAudit,
  type BeschaeftigungsverhaeltnisWrite,
  type EmploymentAuditRow,
  type EmploymentRow,
} from "@/lib/employment-shared";

export const listEmployments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Beschaeftigungsverhaeltnis[]> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("employment_relationships")
      .select("*")
      .order("gueltig_ab", { ascending: false });
    if (error) throw new Error(mapEmploymentDbError(error.message));
    return (data ?? []).map((r) => rowToBeschaeftigung(r as unknown as EmploymentRow));
  });

export const listEmploymentAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BeschaeftigungsAudit[]> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("employment_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(mapEmploymentDbError(error.message));
    return (data ?? []).map((r) => rowToAudit(r as unknown as EmploymentAuditRow));
  });

export const createEmployment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): BeschaeftigungsverhaeltnisWrite => {
    const parsed = createEmploymentSchema.safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Angaben.");
    return parsed.data as BeschaeftigungsverhaeltnisWrite;
  })
  .handler(async ({ data, context }): Promise<Beschaeftigungsverhaeltnis> => {
    await assertFinanzRolle(context.supabase, context.userId);
    await assertDriverExists(context.supabase, data.fahrerId);

    const { data: created, error } = await context.supabase
      .from("employment_relationships")
      // Nie automatisch verifizieren – zusätzlich per DB-Trigger erzwungen.
      .insert({ ...beschaeftigungToRow(data), status: "pruefung_erforderlich" } as never)
      .select()
      .single();
    if (error) throw new Error(mapEmploymentDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Beschäftigungsverhältnisse",
        entitaet: (created as { id: string }).id,
        aktion: "angelegt",
        beschreibung: "Beschäftigungsverhältnis angelegt – Prüfung erforderlich.",
      },
      context.userId,
    );

    return rowToBeschaeftigung(created as unknown as EmploymentRow);
  });

export const updateEmployment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: BeschaeftigungsverhaeltnisWrite } => {
    const parsed = updateEmploymentSchema.safeParse(data);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Ungültige Angaben.");
    return parsed.data as { id: string; values: BeschaeftigungsverhaeltnisWrite };
  })
  .handler(async ({ data, context }): Promise<Beschaeftigungsverhaeltnis> => {
    await assertFinanzRolle(context.supabase, context.userId);
    await assertDriverExists(context.supabase, data.values.fahrerId);

    const { data: updated, error } = await context.supabase
      .from("employment_relationships")
      .update(beschaeftigungToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(mapEmploymentDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Beschäftigungsverhältnisse",
        entitaet: data.id,
        aktion: "geaendert",
        beschreibung: "Beschäftigungsverhältnis geändert – erneute Prüfung erforderlich.",
      },
      context.userId,
    );

    return rowToBeschaeftigung(updated as unknown as EmploymentRow);
  });

/**
 * Verifizierung (Vier-Augen-Prinzip). Es wird ausschließlich der Status gesetzt;
 * Prüfer, Zeitpunkt und die Ablehnung der Selbstverifizierung übernimmt der
 * DB-Trigger `enforce_employment_rules`.
 */
export const verifyEmployment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = employmentIdSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Kennung.");
    return parsed.data;
  })
  .handler(async ({ data, context }): Promise<Beschaeftigungsverhaeltnis> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { data: updated, error } = await context.supabase
      .from("employment_relationships")
      .update({ status: "verifiziert" } as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(mapEmploymentDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Beschäftigungsverhältnisse",
        entitaet: data.id,
        aktion: "verifiziert",
        beschreibung: "Beschäftigungsverhältnis verifiziert (Vier-Augen-Prinzip).",
      },
      context.userId,
    );

    return rowToBeschaeftigung(updated as unknown as EmploymentRow);
  });

export const deleteEmployment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } => {
    const parsed = employmentIdSchema.safeParse(data);
    if (!parsed.success) throw new Error("Ungültige Kennung.");
    return parsed.data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("employment_relationships")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(mapEmploymentDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Beschäftigungsverhältnisse",
        entitaet: data.id,
        aktion: "geloescht",
        beschreibung: "Beschäftigungsverhältnis gelöscht.",
      },
      context.userId,
    );
    return { ok: true } as const;
  });
