// Monitoring der MCP-Werkzeug-Ausführungen (Agenten-Zugriffe).
// Liest ausschließlich Metadaten aus dem Audit-Log; nur für die Rolle Admin.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface McpAufruf {
  id: string;
  /** ISO-Zeitpunkt der Ausführung. */
  zeitpunkt: string;
  tool: string;
  scope: string | null;
  /** "erfolg" | "fehler" | "abgelehnt" */
  status: string;
  dauerMs: number | null;
  rolle: string | null;
  clientId: string | null;
}

export interface McpMonitoring {
  aufrufe: McpAufruf[];
  gesamt: number;
  erfolge: number;
  fehler: number;
  abgelehnt: number;
  /** Median-freier, einfacher Durchschnitt der Dauer in ms (0 bei keinen Daten). */
  durchschnittMs: number;
}

interface QuellenMeta {
  kanal?: string;
  tool?: string;
  scope?: string;
  status?: string;
  client_id?: string | null;
}

export const getMcpMonitoring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number } | undefined) => ({
    limit: Math.min(Math.max(data?.limit ?? 50, 1), 200),
  }))
  .handler(async ({ data, context }): Promise<McpMonitoring> => {
    const { data: rollen } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const istAdmin = (rollen ?? []).some((r) => r.role === "admin");
    if (!istAdmin) throw new Error("Kein Zugriff auf das Agenten-Monitoring.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: zeilen, error } = await supabaseAdmin
      .from("ai_audit_log")
      .select("id, created_at, dauer_ms, erfolg, rolle, quellen, werkzeuge, modell")
      .eq("modell", "mcp")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const aufrufe: McpAufruf[] = (zeilen ?? []).map((z) => {
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

    const dauern = aufrufe.map((a) => a.dauerMs ?? 0).filter((d) => d > 0);
    return {
      aufrufe,
      gesamt: aufrufe.length,
      erfolge: aufrufe.filter((a) => a.status === "erfolg").length,
      fehler: aufrufe.filter((a) => a.status === "fehler").length,
      abgelehnt: aufrufe.filter((a) => a.status === "abgelehnt").length,
      durchschnittMs:
        dauern.length > 0 ? Math.round(dauern.reduce((s, d) => s + d, 0) / dauern.length) : 0,
    };
  });
