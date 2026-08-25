// Leseseite des Ablehnungsprotokolls für Daueraufträge (Admin-Bericht).
// RLS erlaubt SELECT ausschließlich Administratoren; die Serverfunktion gibt
// nur den Grund und die betroffenen Felder zurück – keine Rohdaten.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FeldFehler } from "@/lib/recurring-validation";

export type DauerauftragAblehnung = {
  id: string;
  zeitpunkt: string;
  aktion: "create" | "update" | "delete" | "generate";
  zielId: string | null;
  patient: string | null;
  grund: string;
  felder: FeldFehler[];
};

type Row = {
  id: string;
  created_at: string;
  aktion: string;
  ziel_id: string | null;
  patient: string | null;
  grund: string;
  felder: unknown;
};

const listSchema = z
  .object({
    tage: z.number().int().min(1).max(365).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .strict();

export const listRecurringRejections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { tage?: number; limit?: number } | undefined) => listSchema.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<DauerauftragAblehnung[]> => {
    const tage = data.tage ?? 30;
    const ab = new Date(Date.now() - tage * 86_400_000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("recurring_rejections")
      .select("id, created_at, aktion, ziel_id, patient, grund, felder")
      .gte("created_at", ab)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      zeitpunkt: r.created_at,
      aktion: (["create", "update", "delete", "generate"].includes(r.aktion)
        ? r.aktion
        : "create") as DauerauftragAblehnung["aktion"],
      zielId: r.ziel_id,
      patient: r.patient,
      grund: r.grund,
      felder: Array.isArray(r.felder) ? (r.felder as FeldFehler[]) : [],
    }));
  });
