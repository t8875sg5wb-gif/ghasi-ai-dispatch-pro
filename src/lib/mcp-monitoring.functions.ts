// Monitoring der MCP-Werkzeug-Ausführungen (Agenten-Zugriffe).
// Liest ausschließlich Metadaten aus dem Audit-Log; nur für die Rolle Admin.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fasseZusammen, filterAufrufe, type McpMonitoring } from "@/lib/mcp-monitoring-shared";
import { ladeMcpAufrufe, mcpFilterSchema } from "@/lib/mcp-monitoring.server";

export const getMcpMonitoring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(mcpFilterSchema)
  .handler(async ({ data, context }): Promise<McpMonitoring> => {
    const alle = await ladeMcpAufrufe(context.supabase, context.userId, data.limit);
    const gefiltert = filterAufrufe(alle, data);
    return { aufrufe: gefiltert, ...fasseZusammen(gefiltert, alle) };
  });
