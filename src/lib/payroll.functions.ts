// Serverfunktionen für die geprüften Lohn-Grundlagen (Finanzbereich):
// Lohn-Eingabefakten je Fahrer und organisationsweite Lohn-Regelwerke.
//
// SICHERHEIT:
// - Alle Funktionen laufen als angemeldeter Benutzer; RLS + DB-Trigger
//   beschränken Lesen und Schreiben auf die Rollen admin/finanz.
// - Zusätzlich wird die Rolle serverseitig geprüft (defense in depth).
// - Status, Version, Ersteller, Prüfer und Zeitstempel setzt ausschließlich
//   die Datenbank; Client-Werte werden nie übernommen.
// - Es wird kein Wert geraten oder vorbelegt.
// - Bewusst KEINE Lohnberechnung, keine Anwendung der Regeln auf Fahrer.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinanzRolle } from "@/lib/employment-security.server";
import { assertDriverExists } from "@/lib/identity-checks.server";
import {
  createFaktSchema,
  createRegelSchema,
  lohnFaktToRow,
  lohnRegelToRow,
  mapPayrollDbError,
  payrollIdSchema,
  rowToLohnFakt,
  rowToLohnRegel,
  rowToPayrollAudit,
  updateFaktSchema,
  updateRegelSchema,
  type LohnFakt,
  type LohnFaktWrite,
  type LohnRegel,
  type LohnRegelWrite,
  type PayrollAudit,
  type PayrollAuditRow,
  type PayrollFactRow,
  type PayrollRuleRow,
} from "@/lib/payroll-shared";

function parseOrThrow<T>(
  schema: { safeParse: (d: unknown) => { success: boolean; data?: unknown; error?: unknown } },
  data: unknown,
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issues = (parsed.error as { issues?: { message?: string }[] } | undefined)?.issues;
    throw new Error(issues?.[0]?.message ?? "Ungültige Angaben.");
  }
  return parsed.data as T;
}

/* ================================================================== *
 * 1) Lohn-Eingabefakten
 * ================================================================== */

export const listPayrollFacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LohnFakt[]> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("payroll_facts")
      .select("*")
      .order("gueltig_ab", { ascending: false });
    if (error) throw new Error(mapPayrollDbError(error.message));
    return (data ?? []).map((r) => rowToLohnFakt(r as unknown as PayrollFactRow));
  });

export const listPayrollFactAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayrollAudit[]> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("payroll_fact_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(mapPayrollDbError(error.message));
    return (data ?? []).map((r) => rowToPayrollAudit(r as unknown as PayrollAuditRow));
  });

export const createPayrollFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): LohnFaktWrite => parseOrThrow<LohnFaktWrite>(createFaktSchema, data))
  .handler(async ({ data, context }): Promise<LohnFakt> => {
    await assertFinanzRolle(context.supabase, context.userId);
    await assertDriverExists(context.supabase, data.fahrerId);

    const { data: created, error } = await context.supabase
      .from("payroll_facts")
      // Nie automatisch verifizieren – zusätzlich per DB-Trigger erzwungen.
      .insert({ ...lohnFaktToRow(data), status: "pruefung_erforderlich" } as never)
      .select()
      .single();
    if (error) throw new Error(mapPayrollDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohn-Eingabefakten",
        entitaet: (created as { id: string }).id,
        aktion: "angelegt",
        beschreibung: `Lohn-Eingabefakt „${data.faktSchluessel}“ angelegt – Prüfung erforderlich.`,
      },
      context.userId,
    );

    return rowToLohnFakt(created as unknown as PayrollFactRow);
  });

export const updatePayrollFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: LohnFaktWrite } =>
    parseOrThrow<{ id: string; values: LohnFaktWrite }>(updateFaktSchema, data),
  )
  .handler(async ({ data, context }): Promise<LohnFakt> => {
    await assertFinanzRolle(context.supabase, context.userId);
    await assertDriverExists(context.supabase, data.values.fahrerId);

    const { data: updated, error } = await context.supabase
      .from("payroll_facts")
      .update(lohnFaktToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(mapPayrollDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohn-Eingabefakten",
        entitaet: data.id,
        aktion: "geaendert",
        beschreibung: "Lohn-Eingabefakt geändert – erneute Prüfung erforderlich.",
      },
      context.userId,
    );

    return rowToLohnFakt(updated as unknown as PayrollFactRow);
  });

/**
 * Verifizierung (Vier-Augen-Prinzip). Es wird ausschließlich der Status gesetzt;
 * Prüfer, Zeitpunkt und die Ablehnung der Selbstverifizierung übernimmt der
 * DB-Trigger `enforce_payroll_fact_rules`.
 */
export const verifyPayrollFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } =>
    parseOrThrow<{ id: string }>(payrollIdSchema, data),
  )
  .handler(async ({ data, context }): Promise<LohnFakt> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { data: updated, error } = await context.supabase
      .from("payroll_facts")
      .update({ status: "verifiziert" } as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(mapPayrollDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohn-Eingabefakten",
        entitaet: data.id,
        aktion: "verifiziert",
        beschreibung: "Lohn-Eingabefakt verifiziert (Vier-Augen-Prinzip).",
      },
      context.userId,
    );

    return rowToLohnFakt(updated as unknown as PayrollFactRow);
  });

export const deletePayrollFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } =>
    parseOrThrow<{ id: string }>(payrollIdSchema, data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { error } = await context.supabase.from("payroll_facts").delete().eq("id", data.id);
    if (error) throw new Error(mapPayrollDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohn-Eingabefakten",
        entitaet: data.id,
        aktion: "geloescht",
        beschreibung: "Lohn-Eingabefakt gelöscht.",
      },
      context.userId,
    );
    return { ok: true } as const;
  });

/* ================================================================== *
 * 2) Lohn-Regelwerke
 * ================================================================== */

export const listPayrollRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LohnRegel[]> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("payroll_rules")
      .select("*")
      .order("gueltig_ab", { ascending: false });
    if (error) throw new Error(mapPayrollDbError(error.message));
    return (data ?? []).map((r) => rowToLohnRegel(r as unknown as PayrollRuleRow));
  });

export const listPayrollRuleAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PayrollAudit[]> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("payroll_rule_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(mapPayrollDbError(error.message));
    return (data ?? []).map((r) => rowToPayrollAudit(r as unknown as PayrollAuditRow));
  });

export const createPayrollRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): LohnRegelWrite =>
    parseOrThrow<LohnRegelWrite>(createRegelSchema, data),
  )
  .handler(async ({ data, context }): Promise<LohnRegel> => {
    await assertFinanzRolle(context.supabase, context.userId);

    const { data: created, error } = await context.supabase
      .from("payroll_rules")
      // Neue Regeln sind immer Entwurf – zusätzlich per DB-Trigger erzwungen.
      .insert({ ...lohnRegelToRow(data), status: "entwurf" } as never)
      .select()
      .single();
    if (error) throw new Error(mapPayrollDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohn-Regelwerke",
        entitaet: (created as { id: string }).id,
        aktion: "angelegt",
        beschreibung: `Lohnregel „${data.kennung}“ als Entwurf angelegt (Quelle: ${data.quelle} / ${data.quelleVersion}).`,
      },
      context.userId,
    );

    return rowToLohnRegel(created as unknown as PayrollRuleRow);
  });

export const updatePayrollRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string; values: LohnRegelWrite } =>
    parseOrThrow<{ id: string; values: LohnRegelWrite }>(updateRegelSchema, data),
  )
  .handler(async ({ data, context }): Promise<LohnRegel> => {
    await assertFinanzRolle(context.supabase, context.userId);

    const { data: updated, error } = await context.supabase
      .from("payroll_rules")
      .update(lohnRegelToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(mapPayrollDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohn-Regelwerke",
        entitaet: data.id,
        aktion: "geaendert",
        beschreibung: "Lohnregel geändert – erneute Prüfung erforderlich.",
      },
      context.userId,
    );

    return rowToLohnRegel(updated as unknown as PayrollRuleRow);
  });

export const verifyPayrollRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } =>
    parseOrThrow<{ id: string }>(payrollIdSchema, data),
  )
  .handler(async ({ data, context }): Promise<LohnRegel> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { data: updated, error } = await context.supabase
      .from("payroll_rules")
      .update({ status: "verifiziert" } as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(mapPayrollDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohn-Regelwerke",
        entitaet: data.id,
        aktion: "verifiziert",
        beschreibung: "Lohnregel verifiziert (Vier-Augen-Prinzip).",
      },
      context.userId,
    );

    return rowToLohnRegel(updated as unknown as PayrollRuleRow);
  });

export const deletePayrollRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } =>
    parseOrThrow<{ id: string }>(payrollIdSchema, data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { error } = await context.supabase.from("payroll_rules").delete().eq("id", data.id);
    if (error) throw new Error(mapPayrollDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohn-Regelwerke",
        entitaet: data.id,
        aktion: "geloescht",
        beschreibung: "Lohnregel gelöscht.",
      },
      context.userId,
    );
    return { ok: true } as const;
  });
