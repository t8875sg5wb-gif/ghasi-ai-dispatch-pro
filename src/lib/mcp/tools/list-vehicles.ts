import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { rowToFahrzeug, type VehicleRow } from "@/lib/vehicles-shared";

export default defineTool({
  name: "list_vehicles",
  title: "Fahrzeuge auflisten",
  description: "Listet alle Fahrzeuge der Flotte. Optional nach Status filtern.",
  inputSchema: {
    status: z.string().optional().describe("Statusfilter, z.B. 'verfuegbar', 'im_einsatz', 'wartung'."),
    limit: z.number().int().min(1).max(200).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Nicht authentifiziert." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
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
  },
});
