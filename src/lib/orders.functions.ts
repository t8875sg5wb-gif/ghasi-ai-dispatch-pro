// Server functions for persisted transport orders (Aufträge).
// All run as the signed-in user (RLS enforces role-based access).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Auftrag } from "@/lib/auftraege";
import {
  rowToAuftrag,
  writeToRow,
  type OrderRow,
  type OrderWrite,
} from "@/lib/orders-shared";

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Auftrag[]> => {
    const { data, error } = await context.supabase
      .from("orders")
      .select("*")
      .order("termin", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToAuftrag(r as unknown as OrderRow));
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: OrderWrite) => {
    if (!data || typeof data.patient !== "string") {
      throw new Error("patient ist erforderlich");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<Auftrag> => {
    let nummer = data.nummer;
    if (!nummer) {
      const { count } = await context.supabase
        .from("orders")
        .select("*", { count: "exact", head: true });
      nummer = `A-${2045 + (count ?? 0)}`;
    }
    const row = writeToRow({ ...data, nummer, status: data.status ?? "neu" });
    const { data: created, error } = await context.supabase
      .from("orders")
      .insert(row as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToAuftrag(created as unknown as OrderRow);
  });

export const updateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<OrderWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Auftrag> => {
    const row = writeToRow(data.values);
    const { data: updated, error } = await context.supabase
      .from("orders")
      .update(row as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const auftrag = rowToAuftrag(updated as unknown as OrderRow);

    // Audit trail: persist every status / dispatch-assignment / driver change with
    // timestamp, status, driver, vehicle and GPS position (when available).
    const v = data.values as Record<string, unknown>;
    const relevant = ["status", "detail_status", "fahrer", "fahrzeug", "lat", "lng"].some(
      (k) => k in v,
    );
    if (relevant) {
      const gps =
        auftrag.lat != null && auftrag.lng != null
          ? { lat: auftrag.lat, lng: auftrag.lng }
          : null;
      await context.supabase.from("activity_log").insert({
        bereich: "auftraege",
        entitaet: auftrag.id,
        aktion: "status_update",
        beschreibung: `Auftrag ${auftrag.nummer ?? auftrag.id}: Status ${auftrag.status}${
          auftrag.fahrer ? `, Fahrer ${auftrag.fahrer}` : ""
        }${auftrag.fahrzeug ? `, Fahrzeug ${auftrag.fahrzeug}` : ""}`,
        metadaten: {
          status: auftrag.status,
          detailStatus: auftrag.detailStatus ?? null,
          fahrer: auftrag.fahrer ?? null,
          fahrzeug: auftrag.fahrzeug ?? null,
          gps,
          zeitpunkt: new Date().toISOString(),
        } as never,
      } as never);
    }

    return auftrag;
  });


export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * One-time seed: fills the orders table with the original demo set if it is
 * empty. Admin/Disposition only (enforced by RLS on INSERT). Idempotent: does
 * nothing once any orders exist.
 */
export const seedOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("orders")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };

    const { SEED_AUFTRAEGE } = await import("@/lib/auftraege");
    const rows = SEED_AUFTRAEGE.map((a: Auftrag) =>
      writeToRow({
        nummer: a.nummer,
        patient: a.patient,
        transportart: a.transportart,
        prioritaet: a.prioritaet,
        status: a.status,
        abholort: a.abholort,
        zielort: a.zielort,
        termin: a.termin,
        fahrer: a.fahrer,
        fahrzeug: a.fahrzeug,
        kostentraeger: a.kostentraeger,
        notiz: a.notiz,
        verordnung: a.verordnung,
        verordnungDokumentId: a.verordnungDokumentId ?? null,
        mobilitaet: a.mobilitaet ?? null,
        begleitperson: a.begleitperson ?? false,
        abholanforderung: a.abholanforderung ?? "",
        zielanforderung: a.zielanforderung ?? "",
        patientennotiz: a.patientennotiz ?? "",
        medizinischeNotiz: a.medizinischeNotiz ?? "",
      }),
    );
    if (rows.length === 0) return { seeded: 0 };
    const { error } = await context.supabase.from("orders").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });
