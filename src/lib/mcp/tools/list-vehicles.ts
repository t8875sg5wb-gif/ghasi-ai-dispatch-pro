import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { autorisiere } from "../authz";
import { mitAudit } from "../audit";
import { rowToFahrzeug, type VehicleRow } from "@/lib/vehicles-shared";

export default defineTool({
  name: "list_vehicles",
  title: "Fahrzeuge auflisten",
  description: "Listet alle Fahrzeuge der Flotte. Optional nach Status filtern.",
  inputSchema: {
    status: z
      .string()
      .optional()
      .describe("Statusfilter, z.B. 'verfuegbar', 'im_einsatz', 'wartung'."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: mitAudit("list_vehicles", "ghasi:vehicles.read", async ({ status, limit }, ctx) => {
    const gate = await autorisiere(ctx, "ghasi:vehicles.read");
    if (!gate.ok) return gate.error;
    const supabase = gate.supabase;
    let q = supabase
      .from("vehicles")
      .select("*")
      .order("kennzeichen", { ascending: true })
      .limit(limit ?? 100);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const fahrzeuge = (data as unknown as VehicleRow[]).map(rowToFahrzeug);
    return {
      content: [{ type: "text", text: JSON.stringify(fahrzeuge, null, 2) }],
      structuredContent: { vehicles: fahrzeuge, count: fahrzeuge.length },
    };
  }),
});
