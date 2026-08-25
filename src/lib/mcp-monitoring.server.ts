// Server-only Datenzugriff für das MCP-Audit-Monitoring.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { MCP_STATUS_WERTE, type McpAufruf } from "@/lib/mcp-monitoring-shared";

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

export async function ladeMcpAufrufe(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number,
): Promise<McpAufruf[]> {
  const { data: rollen } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const istAdmin = (rollen ?? []).some((r) => r.role === "admin");
  if (!istAdmin) throw new Error("Kein Zugriff auf das Agenten-Monitoring.");

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
