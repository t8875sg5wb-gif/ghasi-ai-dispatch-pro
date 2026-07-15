import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { rowToAuftrag, type OrderRow } from "@/lib/orders-shared";

export default defineTool({
  name: "get_order",
  title: "Auftrag abrufen",
  description: "Ruft einen einzelnen Auftrag per ID oder Auftragsnummer ab.",
  inputSchema: {
    id: z.string().optional().describe("UUID des Auftrags."),
    nummer: z.string().optional().describe("Auftragsnummer, z.B. 'A-2026-0042'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, nummer }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Nicht authentifiziert." }], isError: true };
    }
    if (!id && !nummer) {
      return {
        content: [{ type: "text", text: "Bitte 'id' oder 'nummer' angeben." }],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    const q = supabase.from("orders").select("*").limit(1);
    const { data, error } = id ? await q.eq("id", id) : await q.eq("nummer", nummer!);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data || data.length === 0) {
      return { content: [{ type: "text", text: "Auftrag nicht gefunden." }], isError: true };
    }
    const auftrag = rowToAuftrag(data[0] as unknown as OrderRow);
    return {
      content: [{ type: "text", text: JSON.stringify(auftrag, null, 2) }],
      structuredContent: { order: auftrag },
    };
  },
});
