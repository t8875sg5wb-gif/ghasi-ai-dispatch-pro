// Monitoring der MCP-Werkzeug-Ausführungen (Agenten-Zugriffe).
// Liest ausschließlich Metadaten aus dem Audit-Log; nur für die Rolle Admin.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  csvZeilen,
  fasseZusammen,
  filterAufrufe,
  MCP_CSV_SPALTEN,
  MCP_STATUS_LABEL,
  MCP_STATUS_WERTE,
  type McpAufruf,
  type McpFilter,
  type McpMonitoring,
} from "@/lib/mcp-monitoring-shared";
import { ladeMcpAufrufe, mcpFilterSchema } from "@/lib/mcp-monitoring.server";

export type { McpAufruf, McpFilter, McpMonitoring };
export { csvZeilen, MCP_CSV_SPALTEN, MCP_STATUS_LABEL, MCP_STATUS_WERTE };

export const getMcpMonitoring = createServerFn({ method: "GET" })
  .inputValidator(mcpFilterSchema)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<McpMonitoring> => {
    const alle = await ladeMcpAufrufe(context.supabase, context.userId, data.limit);
    const gefiltert = filterAufrufe(alle, data);
    return { aufrufe: gefiltert, ...fasseZusammen(gefiltert, alle) };
  });
