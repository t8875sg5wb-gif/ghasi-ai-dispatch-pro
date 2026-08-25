import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { autorisiere } from "../authz";
import { rowToAuftrag, type OrderRow } from "@/lib/orders-shared";

export default defineTool({
  name: "list_orders",
  title: "Aufträge auflisten",
  description:
    "Listet Krankentransport-Aufträge der eigenen Firma (RLS). Optional nach Status filtern und Anzahl begrenzen.",
  inputSchema: {
    status: z
      .string()
      .optional()
      .describe("Statusfilter, z.B. 'neu', 'geplant', 'in_fahrt', 'abgeschlossen'."),
    limit: z.number().int().min(1).max(100).optional().describe("Max. Ergebnisse (Standard 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    const gate = await autorisiere(ctx, "ghasi:orders.read");
    if (!gate.ok) return gate.error;
    const supabase = gate.supabase;
    let q = supabase
      .from("orders")
      .select("*")
      .order("termin", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const auftraege = (data as unknown as OrderRow[]).map(rowToAuftrag);
    return {
      content: [{ type: "text", text: JSON.stringify(auftraege, null, 2) }],
      structuredContent: { orders: auftraege, count: auftraege.length },
    };
  },
});
