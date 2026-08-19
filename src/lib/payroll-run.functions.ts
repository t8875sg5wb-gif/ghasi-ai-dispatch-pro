// Serverfunktionen für Lohnläufe (Finanzbereich): Anlegen, Berechnen und
// Vier-Augen-Freigabe (Vorlegen / Freigeben / Ablehnen).
//
// SICHERHEIT:
// - Nur die Rollen admin/finanz: erzwungen durch RLS, DB-Trigger UND einen
//   zusätzlichen serverseitigen Rollen-Check (defense in depth).
// - Version, Zeitstempel, Vorleger, Freigeber und das vollständige
//   Änderungsprotokoll setzt ausschließlich die Datenbank.
// - Vier-Augen-Prinzip, Statusübergänge, Bindung an die Versionsnummer und die
//   Unveränderlichkeit nach Freigabe werden im DB-Trigger erzwungen; die
//   Serverfunktionen setzen nur die Absicht (Status bzw. Ablehnungsgrund).
//
// UMFANG: KEIN Export (kein DATEV, kein Lohnschein/PDF), keine Auszahlung –
// bewusst einem späteren Schritt vorbehalten.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";

import type { Database } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinanzRolle } from "@/lib/employment-security.server";
import { assertDriverExists } from "@/lib/identity-checks.server";
import { rowToBeschaeftigung, type EmploymentRow } from "@/lib/employment-shared";
import {
  rowToLohnFakt,
  rowToLohnRegel,
  type PayrollFactRow,
  type PayrollRuleRow,
} from "@/lib/payroll-shared";
import {
  ablehnenLohnlaufSchema,
  berechneLohnlauf,
  createLohnlaufSchema,
  lohnlaufIdSchema,
  mapLohnlaufDbError,
  monatsZeitraum,
  rowToLohnlauf,
  rowToLohnlaufAudit,
  type Lohnlauf,
  type LohnlaufAblehnung,
  type LohnlaufAudit,
  type LohnlaufWrite,
  type PayrollRunAuditRow,
  type PayrollRunItemRow,
  type PayrollRunRow,
} from "@/lib/payroll-run-shared";

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

async function ladeLauf(supabase: SupabaseClient<Database>, id: string): Promise<Lohnlauf> {
  const { data: run, error } = await supabase
    .from("payroll_runs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(mapLohnlaufDbError(error.message));
  const { data: items, error: e2 } = await supabase
    .from("payroll_run_items")
    .select("*")
    .eq("run_id", id)
    .order("kategorie", { ascending: true });
  if (e2) throw new Error(mapLohnlaufDbError(e2.message));
  return rowToLohnlauf(
    run as unknown as PayrollRunRow,
    (items ?? []) as unknown as PayrollRunItemRow[],
  );
}

export const listPayrollRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Lohnlauf[]> => {
    await assertFinanzRolle(context.supabase, context.userId);

    const { data: runs, error } = await context.supabase
      .from("payroll_runs")
      .select("*")
      .order("periode_monat", { ascending: false });
    if (error) throw new Error(mapLohnlaufDbError(error.message));

    const { data: items, error: e2 } = await context.supabase.from("payroll_run_items").select("*");
    if (e2) throw new Error(mapLohnlaufDbError(e2.message));

    const nachLauf = new Map<string, PayrollRunItemRow[]>();
    for (const it of (items ?? []) as unknown as PayrollRunItemRow[]) {
      const liste = nachLauf.get(it.run_id) ?? [];
      liste.push(it);
      nachLauf.set(it.run_id, liste);
    }

    return ((runs ?? []) as unknown as PayrollRunRow[]).map((r) =>
      rowToLohnlauf(r, nachLauf.get(r.id) ?? []),
    );
  });

export const listPayrollRunAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LohnlaufAudit[]> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("payroll_run_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(mapLohnlaufDbError(error.message));
    return ((data ?? []) as unknown as PayrollRunAuditRow[]).map(rowToLohnlaufAudit);
  });

/** Legt einen leeren Lohnlauf an (Status "offen", keine Ergebnisse). */
export const createPayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: unknown): LohnlaufWrite => parseOrThrow<LohnlaufWrite>(createLohnlaufSchema, data),
  )
  .handler(async ({ data, context }): Promise<Lohnlauf> => {
    await assertFinanzRolle(context.supabase, context.userId);
    await assertDriverExists(context.supabase, data.fahrerId);

    const { ab } = monatsZeitraum(data.monat);
    const { data: created, error } = await context.supabase
      .from("payroll_runs")
      .insert({
        driver_id: data.fahrerId,
        periode_monat: ab,
        notiz: data.notiz ?? "",
      } as never)
      .select()
      .single();
    if (error) throw new Error(mapLohnlaufDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohnläufe",
        entitaet: (created as { id: string }).id,
        aktion: "angelegt",
        beschreibung: `Lohnlauf für ${data.monat} angelegt (noch nicht berechnet).`,
      },
      context.userId,
    );

    return rowToLohnlauf(created as unknown as PayrollRunRow, []);
  });

/**
 * Berechnet einen Lohnlauf neu. Vorherige Posten werden vollständig gelöscht,
 * bevor neue geschrieben werden – es können keine Duplikate entstehen.
 * Fehlt eine verifizierte Grundlage, wird der Lauf "unvollstaendig" mit einer
 * Liste der fehlenden Punkte gespeichert; es wird nichts geschätzt.
 */
export const calculatePayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } =>
    parseOrThrow<{ id: string }>(lohnlaufIdSchema, data),
  )
  .handler(async ({ data, context }): Promise<Lohnlauf> => {
    await assertFinanzRolle(context.supabase, context.userId);

    const { data: runRow, error: runErr } = await context.supabase
      .from("payroll_runs")
      .select("*")
      .eq("id", data.id)
      .single();
    if (runErr) throw new Error(mapLohnlaufDbError(runErr.message));
    const run = runRow as unknown as PayrollRunRow;
    if (run.status === "freigegeben") {
      throw new Error(
        "Ein freigegebener Lohnlauf ist unveränderlich und kann nicht neu berechnet werden.",
      );
    }
    const monat = run.periode_monat.slice(0, 7);

    // Grundlagen: ausschließlich verifizierte Datensätze.
    const [
      { data: empRows, error: e1 },
      { data: ruleRows, error: e2 },
      { data: factRows, error: e3 },
    ] = await Promise.all([
      context.supabase
        .from("employment_relationships")
        .select("*")
        .eq("driver_id", run.driver_id)
        .eq("status", "verifiziert"),
      context.supabase.from("payroll_rules").select("*").eq("status", "verifiziert"),
      context.supabase
        .from("payroll_facts")
        .select("*")
        .eq("driver_id", run.driver_id)
        .eq("status", "verifiziert"),
    ]);
    const fehler = e1 ?? e2 ?? e3;
    if (fehler) throw new Error(mapLohnlaufDbError(fehler.message));

    const ergebnis = berechneLohnlauf({
      monat,
      fahrerId: run.driver_id,
      beschaeftigungen: ((empRows ?? []) as unknown as EmploymentRow[]).map(rowToBeschaeftigung),
      regeln: ((ruleRows ?? []) as unknown as PayrollRuleRow[]).map(rowToLohnRegel),
      fakten: ((factRows ?? []) as unknown as PayrollFactRow[]).map(rowToLohnFakt),
    });

    // 1) Alte Posten restlos entfernen (kein Duplikat, kein Rest).
    const { error: delErr } = await context.supabase
      .from("payroll_run_items")
      .delete()
      .eq("run_id", data.id);
    if (delErr) throw new Error(mapLohnlaufDbError(delErr.message));

    // 2) Neue Posten schreiben (nur bei vollständiger Grundlage vorhanden).
    if (ergebnis.posten.length > 0) {
      const { error: insErr } = await context.supabase.from("payroll_run_items").insert(
        ergebnis.posten.map((p) => ({
          run_id: data.id,
          rule_id: p.regelId,
          regel_kennung: p.regelKennung,
          regel_bezeichnung: p.regelBezeichnung,
          kategorie: p.kategorie,
          berechnungsart: p.berechnungsart,
          prozentsatz: p.prozentsatz,
          festbetrag: p.festbetrag,
          basisbetrag: p.basisbetrag,
          betrag: p.betrag,
          quelle: p.quelle,
          quelle_version: p.quelleVersion,
        })) as never,
      );
      if (insErr) throw new Error(mapLohnlaufDbError(insErr.message));
    }

    // 3) Kopfdaten aktualisieren (Version/Zeitstempel setzt die Datenbank).
    const { error: updErr } = await context.supabase
      .from("payroll_runs")
      .update({
        status: ergebnis.status,
        employment_id: ergebnis.beschaeftigungId,
        verguetungsart: ergebnis.verguetungsart,
        stunden: ergebnis.stunden,
        stundenlohn: ergebnis.stundenlohn,
        brutto: ergebnis.brutto,
        summe_abzuege: ergebnis.summeAbzuege,
        netto: ergebnis.netto,
        summe_arbeitgeberkosten: ergebnis.summeArbeitgeberkosten,
        fehlende_punkte: ergebnis.fehlendePunkte as never,
      } as never)
      .eq("id", data.id);
    if (updErr) throw new Error(mapLohnlaufDbError(updErr.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohnläufe",
        entitaet: data.id,
        aktion: "berechnet",
        beschreibung:
          ergebnis.status === "berechnet"
            ? `Lohnlauf ${monat} berechnet (${ergebnis.posten.length} Posten).`
            : `Lohnlauf ${monat} unvollständig: ${ergebnis.fehlendePunkte.join(" | ")}`,
      },
      context.userId,
    );

    return await ladeLauf(context.supabase, data.id);
  });

export const deletePayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } =>
    parseOrThrow<{ id: string }>(lohnlaufIdSchema, data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertFinanzRolle(context.supabase, context.userId);
    const { error } = await context.supabase.from("payroll_runs").delete().eq("id", data.id);
    if (error) throw new Error(mapLohnlaufDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohnläufe",
        entitaet: data.id,
        aktion: "geloescht",
        beschreibung: "Lohnlauf gelöscht.",
      },
      context.userId,
    );
    return { ok: true } as const;
  });

/* ================================================================== *
 * Vier-Augen-Freigabe
 * ================================================================== */

/**
 * Legt einen berechneten Lohnlauf zur Freigabe vor.
 * Vorlage nur aus Status "berechnet" möglich (Trigger erzwingt dies erneut);
 * Vorleger, Zeitpunkt und die Bindung an die Versionsnummer setzt die Datenbank.
 */
export const submitPayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } =>
    parseOrThrow<{ id: string }>(lohnlaufIdSchema, data),
  )
  .handler(async ({ data, context }): Promise<Lohnlauf> => {
    await assertFinanzRolle(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("payroll_runs")
      .update({ status: "zur_freigabe" } as never)
      .eq("id", data.id);
    if (error) throw new Error(mapLohnlaufDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohnläufe",
        entitaet: data.id,
        aktion: "vorgelegt",
        beschreibung: "Lohnlauf zur Freigabe vorgelegt (Vier-Augen-Prinzip).",
      },
      context.userId,
    );

    return await ladeLauf(context.supabase, data.id);
  });

/**
 * Gibt einen vorgelegten Lohnlauf frei. Selbst-Freigabe, veralteter
 * Rechenstand und unzulässige Ausgangszustände werden im DB-Trigger abgelehnt.
 * Danach sind Lohnlauf und Posten technisch unveränderlich.
 */
export const approvePayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown): { id: string } =>
    parseOrThrow<{ id: string }>(lohnlaufIdSchema, data),
  )
  .handler(async ({ data, context }): Promise<Lohnlauf> => {
    await assertFinanzRolle(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("payroll_runs")
      .update({ status: "freigegeben" } as never)
      .eq("id", data.id);
    if (error) throw new Error(mapLohnlaufDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohnläufe",
        entitaet: data.id,
        aktion: "freigegeben",
        beschreibung: "Lohnlauf freigegeben – ab jetzt unveränderlich.",
      },
      context.userId,
    );

    return await ladeLauf(context.supabase, data.id);
  });

/**
 * Lehnt einen vorgelegten Lohnlauf mit Pflichtgrund ab. Der Lauf geht in den
 * bearbeitbaren Zustand "berechnet" zurück (Neuberechnung möglich).
 */
export const rejectPayrollRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (data: unknown): LohnlaufAblehnung =>
      parseOrThrow<LohnlaufAblehnung>(ablehnenLohnlaufSchema, data),
  )
  .handler(async ({ data, context }): Promise<Lohnlauf> => {
    await assertFinanzRolle(context.supabase, context.userId);

    const { error } = await context.supabase
      .from("payroll_runs")
      // Status setzt der Trigger verbindlich auf "berechnet" zurück.
      .update({ status: "berechnet", ablehnung_grund: data.grund } as never)
      .eq("id", data.id);
    if (error) throw new Error(mapLohnlaufDbError(error.message));

    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Lohnläufe",
        entitaet: data.id,
        aktion: "abgelehnt",
        beschreibung: `Lohnlauf abgelehnt: ${data.grund}`,
      },
      context.userId,
    );

    return await ladeLauf(context.supabase, data.id);
  });
