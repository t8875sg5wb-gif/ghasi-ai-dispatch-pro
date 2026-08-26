// Server-only Datenzugriff für das MCP-Audit-Monitoring.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  MCP_STATUS_WERTE,
  type McpArchiv,
  type McpArchivEintrag,
  type McpAufruf,
} from "@/lib/mcp-monitoring-shared";

const isoTag = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT erwartet")
  .optional();

const filterSchema = z
  .object({
    limit: z.number().int().min(1).max(500).default(100),
    suche: z.string().max(120).optional(),
    tool: z.string().max(80).optional(),
    rolle: z.string().max(40).optional(),
    scope: z.string().max(80).optional(),
    status: z.enum([...MCP_STATUS_WERTE, "alle"]).optional(),
    von: isoTag,
    bis: isoTag,
  })
  .strict();

export const mcpFilterSchema = (data: unknown) => filterSchema.parse(data ?? {});

interface QuellenMeta {
  kanal?: string;
  tool?: string;
  scope?: string;
  status?: string;
  client_id?: string | null;
}

/** Fail-closed Admin-Prüfung über den Client des Aufrufers (RLS gilt). */
async function assertAdmin(supabase: SupabaseClient<Database>, userId: string): Promise<void> {
  const { data: rollen } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const istAdmin = (rollen ?? []).some((r) => r.role === "admin");
  if (!istAdmin) throw new Error("Kein Zugriff auf das Agenten-Monitoring.");
}

export async function ladeMcpAufrufe(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number,
): Promise<McpAufruf[]> {
  await assertAdmin(supabase, userId);


  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: zeilen, error } = await supabaseAdmin
    .from("ai_audit_log")
    .select("id, created_at, dauer_ms, erfolg, rolle, quellen, werkzeuge, modell")
    .eq("modell", "mcp")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (zeilen ?? []).map((z) => {
    const q = (z.quellen ?? {}) as QuellenMeta;
    return {
      id: z.id,
      zeitpunkt: z.created_at,
      tool: q.tool ?? z.werkzeuge?.[0] ?? "unbekannt",
      scope: q.scope ?? null,
      status: q.status ?? (z.erfolg ? "erfolg" : "fehler"),
      dauerMs: z.dauer_ms ?? null,
      rolle: z.rolle ?? null,
      clientId: q.client_id ?? null,
    };
  });
}

/** Eingestellte Aufbewahrungsdauer (Monate) im aktiven Bereich, hart begrenzt auf 1–120. */
export async function ladeMcpFrist(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("company_settings")
    .select("mcp_audit_retention_months")
    .eq("singleton", 1)
    .maybeSingle();
  const roh = Number(data?.mcp_audit_retention_months ?? 12);
  return Math.min(120, Math.max(1, Math.round(Number.isFinite(roh) ? roh : 12)));
}

/**
 * Verschiebt alle MCP-Audit-Einträge, die älter als die eingestellte Frist sind,
 * ins Archiv. Unteilbar in der Datenbank (DELETE ... RETURNING + INSERT).
 * Gelöscht wird nichts – der Prüfpfad bleibt vollständig erhalten.
 */
export async function archiviereMcpAudit(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ verschoben: number; fristMonate: number }> {
  await assertAdmin(supabase, userId);
  const fristMonate = await ladeMcpFrist();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("archive_mcp_audit_logs", {
    p_monate: fristMonate,
  });
  if (error) throw new Error(error.message);
  return { verschoben: Number(data ?? 0), fristMonate };
}

/** Lädt den Archivbereich (nur Admin) inklusive Gesamtzahl und Fristangabe. */
export async function ladeMcpArchiv(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number,
): Promise<McpArchiv> {
  await assertAdmin(supabase, userId);
  const fristMonate = await ladeMcpFrist();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: zeilen, error } = await supabaseAdmin
    .from("ai_audit_log_archive")
    .select(
      "id, created_at, dauer_ms, erfolg, rolle, quellen, werkzeuge, archiviert_am, archiv_frist_monate",
    )
    .eq("modell", "mcp")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const { count } = await supabaseAdmin
    .from("ai_audit_log_archive")
    .select("id", { count: "exact", head: true })
    .eq("modell", "mcp");

  const { data: aeltester } = await supabaseAdmin
    .from("ai_audit_log")
    .select("created_at")
    .eq("modell", "mcp")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const eintraege: McpArchivEintrag[] = (zeilen ?? []).map((z) => {
    const q = (z.quellen ?? {}) as QuellenMeta;
    return {
      id: z.id,
      zeitpunkt: z.created_at,
      tool: q.tool ?? z.werkzeuge?.[0] ?? "unbekannt",
      scope: q.scope ?? null,
      status: q.status ?? (z.erfolg ? "erfolg" : "fehler"),
      dauerMs: z.dauer_ms ?? null,
      rolle: z.rolle ?? null,
      clientId: q.client_id ?? null,
      archiviertAm: z.archiviert_am,
      fristMonate: z.archiv_frist_monate,
    };
  });

  return {
    eintraege,
    gesamt: count ?? eintraege.length,
    fristMonate,
    aeltesterAktiv: aeltester?.created_at ?? null,
  };
}
