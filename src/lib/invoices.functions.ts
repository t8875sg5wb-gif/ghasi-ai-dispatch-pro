// Server functions for persisted invoices (Rechnungen) and server-side billing
// logic. All run as the signed-in user (RLS enforces finance-role access).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Rechnung } from "@/lib/finance";
import type { Auftrag } from "@/lib/auftraege";
import {
  rowToRechnung,
  writeToInvoiceRow,
  abrechnungsBereitschaft,
  preisFuer,
  type InvoiceRow,
  type InvoiceWrite,
} from "@/lib/invoices-shared";
import { rowToAuftrag, type OrderRow } from "@/lib/orders-shared";
import { modusFuerTransportart, satzFuer, STEUER_HINWEIS } from "@/lib/steuer";

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Rechnung[]> => {
    const { data, error } = await context.supabase
      .from("invoices")
      .select("*")
      .order("datum", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToRechnung(r as unknown as InvoiceRow));
  });

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: InvoiceWrite) => {
    if (!data || typeof data.kunde !== "string") {
      throw new Error("kunde ist erforderlich");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<Rechnung> => {
    const row = writeToInvoiceRow(data);
    const { data: created, error } = await context.supabase
      .from("invoices")
      .insert(row as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToRechnung(created as unknown as InvoiceRow);
  });

export const updateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<InvoiceWrite> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Rechnung> => {
    const row = writeToInvoiceRow(data.values);
    const { data: updated, error } = await context.supabase
      .from("invoices")
      .update(row as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToRechnung(updated as unknown as InvoiceRow);
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("invoices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * One-time seed: fills the invoices table with the original demo set if it is
 * empty. Idempotent: does nothing once any invoice exists.
 */
export const seedInvoices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("invoices")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };

    const { SEED_RECHNUNGEN } = await import("@/lib/finance");
    const { rechnungToWrite } = await import("@/lib/invoices-shared");
    const rows = SEED_RECHNUNGEN.map((r: Rechnung) => writeToInvoiceRow(rechnungToWrite(r)));
    if (rows.length === 0) return { seeded: 0 };
    const { error } = await context.supabase.from("invoices").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });

/* ------------------------------------------------------------------ *
 * Server-side billing logic
 * ------------------------------------------------------------------ */

type SupabaseReadClient = {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>;
  };
};

async function loadOrders(supabase: SupabaseReadClient): Promise<Auftrag[]> {
  const { data, error } = await supabase.from("orders").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: unknown) => rowToAuftrag(r as OrderRow));
}

async function loadInvoices(supabase: SupabaseReadClient): Promise<Rechnung[]> {
  const { data, error } = await supabase.from("invoices").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: unknown) => rowToRechnung(r as InvoiceRow));
}

function abrechnungsartFuer(kostentraeger: string): "Krankenkasse" | "Patient" | "Kunde" {
  const k = kostentraeger.toLowerCase();
  if (/kasse|aok|barmer|dak|tk|techniker|krankenkasse|kkh|ikk/.test(k)) {
    return "Krankenkasse";
  }
  if (/selbstzahler|patient|privat/.test(k)) return "Patient";
  return "Kunde";
}

/** Billing-ready completed transports that do not yet have an invoice. */
export const billingReadyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ nummer: string; patient: string; betrag: number }[]> => {
    const [orders, invoices] = await Promise.all([
      loadOrders(context.supabase),
      loadInvoices(context.supabase),
    ]);
    const berechnet = new Set(invoices.map((r) => r.bezugAuftrag).filter(Boolean));
    return orders
      .filter((a) => abrechnungsBereitschaft(a).bereit && !berechnet.has(a.nummer))
      .map((a) => ({ nummer: a.nummer, patient: a.patient, betrag: preisFuer(a) }));
  });

/**
 * Generates draft invoices for every billing-ready completed transport that has
 * no invoice yet. Drafts wait for manual approval — nothing is ever sent.
 * Duplicate-safe: skips orders that already have a linked invoice.
 */
export const generateBillingDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ created: number; nummern: string[] }> => {
    const [orders, invoices] = await Promise.all([
      loadOrders(context.supabase),
      loadInvoices(context.supabase),
    ]);
    const berechnet = new Set(invoices.map((r) => r.bezugAuftrag).filter(Boolean));

    const heute = new Date();
    const datum = heute.toISOString().slice(0, 10);
    const faellig = new Date(heute.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
    let lfd = 1 + invoices.filter((r) => r.typ === "rechnung").length;

    const writes: Record<string, unknown>[] = [];
    const nummern: string[] = [];
    for (const a of orders) {
      if (!abrechnungsBereitschaft(a).bereit) continue;
      if (berechnet.has(a.nummer)) continue;
      const betrag = preisFuer(a);
      const art = abrechnungsartFuer(a.kostentraeger);
      const modus = modusFuerTransportart(a.transportart);
      const mwst = satzFuer(modus);
      const nummer = `RE-2026-${String(40 + lfd++).padStart(4, "0")}`;
      nummern.push(nummer);
      writes.push(
        writeToInvoiceRow({
          nummer,
          typ: "rechnung",
          kunde: a.kostentraeger,
          kundeId: "",
          abrechnungsart: art,
          betrag,
          mwstSatz: mwst,
          status: "entwurf",
          datum,
          faelligkeit: faellig,
          bezugAuftrag: a.nummer,
          positionen: [
            { beschreibung: `${a.transportart} ${a.nummer}`, menge: 1, einzelpreis: betrag },
          ],
          notiz: `Automatisch vorbereiteter Entwurf – Versand nur nach Freigabe. ${STEUER_HINWEIS[modus]}`,
        }),
      );
      berechnet.add(a.nummer);
    }

    if (writes.length === 0) return { created: 0, nummern: [] };
    const { error } = await context.supabase.from("invoices").insert(writes as never);
    if (error) throw new Error(error.message);
    return { created: writes.length, nummern };
  });

/** Server-side duplicate detection: same customer + amount + ≤7 days apart. */
export const detectInvoiceDuplicates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ a: string; b: string; betrag: number }[]> => {
    const invoices = await loadInvoices(context.supabase);
    const out: { a: string; b: string; betrag: number }[] = [];
    for (let i = 0; i < invoices.length; i++) {
      for (let j = i + 1; j < invoices.length; j++) {
        const a = invoices[i];
        const b = invoices[j];
        if (a.typ !== "rechnung" || b.typ !== "rechnung") continue;
        if (a.kunde !== b.kunde || a.betrag !== b.betrag) continue;
        const diff =
          Math.abs(new Date(a.datum).getTime() - new Date(b.datum).getTime()) / 86_400_000;
        if (diff <= 7) out.push({ a: a.nummer, b: b.nummer, betrag: a.betrag });
      }
    }
    return out;
  });

/** Server-side missing-invoice detection: completed transports without invoice. */
export const detectMissingInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ nummer: string; patient: string }[]> => {
    const [orders, invoices] = await Promise.all([
      loadOrders(context.supabase),
      loadInvoices(context.supabase),
    ]);
    const berechnet = new Set(invoices.map((r) => r.bezugAuftrag).filter(Boolean));
    return orders
      .filter((a) => a.status === "abgeschlossen" && !berechnet.has(a.nummer))
      .map((a) => ({ nummer: a.nummer, patient: a.patient }));
  });
