import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { autorisiere } from "../authz";
import { mitAudit } from "../audit";
import { rowToAuftrag, type OrderRow } from "@/lib/orders-shared";

export default defineTool({
  name: "update_order_status",
  title: "Auftragsstatus ändern",
  description:
    "Setzt den Status eines bestehenden Auftrags (optional zusätzlich den Detail-Status). Andere Auftragsfelder werden nicht verändert.",
  inputSchema: {
    id: z.string().uuid().describe("UUID des Auftrags."),
    status: z
      .enum(["neu", "disponiert", "unterwegs", "abgeschlossen", "storniert"])
      .describe("Neuer Auftragsstatus."),
    detailStatus: z
      .string()
      .trim()
      .max(100)
      .optional()
      .describe("Optionaler Detail-Status, z.B. 'beim_patienten'."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: mitAudit(
    "update_order_status",
    "ghasi:orders.status",
    async ({ id, status, detailStatus }, ctx) => {
      const gate = await autorisiere(ctx, "ghasi:orders.status");
      if (!gate.ok) return gate.error;
      const supabase = gate.supabase;
      const row: Record<string, unknown> = { status };
      if (detailStatus !== undefined) row.detail_status = detailStatus;
      const { data, error } = await supabase
        .from("orders")
        .update(row as never)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) return { content: [{ type: "text", text: error.message }], isError: true };
      if (!data) {
        return { content: [{ type: "text", text: "Auftrag nicht gefunden." }], isError: true };
      }
      const auftrag = rowToAuftrag(data as unknown as OrderRow);
      return {
        content: [{ type: "text", text: JSON.stringify(auftrag, null, 2) }],
        structuredContent: { order: auftrag },
      };
    },
  ),
});
