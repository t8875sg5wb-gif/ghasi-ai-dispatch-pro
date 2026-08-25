import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { autorisiere } from "../authz";
import { mitAudit } from "../audit";
import { rowToFahrer, type DriverRow } from "@/lib/drivers-shared";

export default defineTool({
  name: "list_drivers",
  title: "Fahrer auflisten",
  description: "Listet alle Fahrer der eigenen Firma. Optional nach Status filtern.",
  inputSchema: {
    status: z.string().optional().describe("Statusfilter, z.B. 'aktiv', 'krank', 'urlaub'."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: mitAudit("list_drivers", "ghasi:drivers.read", async ({ status, limit }, ctx) => {
    const gate = await autorisiere(ctx, "ghasi:drivers.read");
    if (!gate.ok) return gate.error;
    const supabase = gate.supabase;
    let q = supabase
      .from("drivers")
      .select("*")
      .order("name", { ascending: true })
      .limit(limit ?? 100);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const fahrer = (data as unknown as DriverRow[]).map(rowToFahrer);
    return {
      content: [{ type: "text", text: JSON.stringify(fahrer, null, 2) }],
      structuredContent: { drivers: fahrer, count: fahrer.length },
    };
  }),
});
