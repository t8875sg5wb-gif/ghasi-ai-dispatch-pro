// Monitoring der MCP-Werkzeug-Ausführungen (Agenten-Zugriffe).
// Liest ausschließlich Metadaten aus dem Audit-Log; nur für die Rolle Admin.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  fasseZusammen,
  filterAufrufe,
  type McpArchiv,
  type McpMonitoring,
} from "@/lib/mcp-monitoring-shared";
import { ladeMcpAufrufe, mcpFilterSchema } from "@/lib/mcp-monitoring.server";

export const getMcpMonitoring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(mcpFilterSchema)
  .handler(async ({ data, context }): Promise<McpMonitoring> => {
    const alle = await ladeMcpAufrufe(context.supabase, context.userId, data.limit);
    const gefiltert = filterAufrufe(alle, data);
    return { aufrufe: gefiltert, ...fasseZusammen(gefiltert, alle) };
  });

const archivSchema = z
  .object({ limit: z.number().int().min(1).max(500).default(100) })
  .strict();

/** Archivbereich: Einträge, die die Aufbewahrungsdauer im aktiven Bereich überschritten haben. */
export const getMcpArchiv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => archivSchema.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<McpArchiv> => {
    const { ladeMcpArchiv } = await import("@/lib/mcp-monitoring.server");
    return ladeMcpArchiv(context.supabase, context.userId, data.limit);
  });

/**
 * Manueller Archivierungslauf. Der reguläre Lauf erfolgt automatisch täglich in
 * der Datenbank; dieser Aufruf ist nur die sofortige Auslösung für Admins.
 */
export const archiviereMcpAuditJetzt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ verschoben: number; fristMonate: number }> => {
    const { archiviereMcpAudit } = await import("@/lib/mcp-monitoring.server");
    const ergebnis = await archiviereMcpAudit(context.supabase, context.userId);
    const { logActivitySafe } = await import("@/lib/activity-log.server");
    await logActivitySafe(
      {
        bereich: "Administration",
        entitaet: null,
        aktion: "Agenten-Audit archiviert",
        beschreibung: `${ergebnis.verschoben} Agenten-Audit-Einträge älter als ${ergebnis.fristMonate} Monate ins Archiv verschoben.`,
        metadaten: ergebnis,
      },
      context.userId,
    );
    return ergebnis;
  });
