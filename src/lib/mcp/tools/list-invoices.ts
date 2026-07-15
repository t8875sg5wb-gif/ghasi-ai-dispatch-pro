import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { rowToRechnung, type InvoiceRow } from "@/lib/invoices-shared";

export default defineTool({
  name: "list_invoices",
  title: "Rechnungen auflisten",
  description: "Listet Rechnungen. Optional nach Status filtern (z.B. 'offen', 'bezahlt', 'ueberfaellig').",
  inputSchema: {
    status: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Nicht authentifiziert." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("invoices")
      .select("*")
      .order("datum", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rechnungen = (data as unknown as InvoiceRow[]).map(rowToRechnung);
    return {
      content: [{ type: "text", text: JSON.stringify(rechnungen, null, 2) }],
      structuredContent: { invoices: rechnungen, count: rechnungen.length },
    };
  },
});
