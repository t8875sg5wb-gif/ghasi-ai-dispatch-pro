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
import { rowToKassenvertrag, type KassenvertragRow } from "@/lib/insurer-contracts-shared";
import { rowToPatient, type PatientRow } from "@/lib/patients-shared";
import {
  ermittleVertragspreis,
  findeInsurerId,
  KEIN_VERTRAG_HINWEIS,
  type InsurerLike,
} from "@/lib/contract-pricing";
import { EUR2 } from "@/lib/finance";

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
    // Load the previous state first so we can log a GoBD-oriented audit trail.
    const { data: before } = await context.supabase
      .from("invoices")
      .select("*")
      .eq("id", data.id)
      .single();

    const row = writeToInvoiceRow(data.values);
    const { data: updated, error } = await context.supabase
      .from("invoices")
      .update(row as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Record every changed scalar field as an audit entry.
    if (before) {
      const akteur =
        (typeof context.claims?.email === "string" ? context.claims.email : "") ||
        context.userId;
      const changes = diffInvoiceFields(
        before as Record<string, unknown>,
        updated as Record<string, unknown>,
        row,
      );
      const entries = changes.map((c) => ({
        invoice_id: data.id,
        invoice_nummer: (updated as { nummer?: string }).nummer ?? null,
        akteur,
        feld: c.feld,
        alt_wert: c.alt,
        neu_wert: c.neu,
      }));
      if (entries.length > 0) {
        await context.supabase.from("invoice_changes").insert(entries as never);
      }
    }

    return rowToRechnung(updated as unknown as InvoiceRow);
  });

/** Human-readable labels for audited invoice fields. */
const FELD_LABEL: Record<string, string> = {
  status: "Status",
  betrag: "Betrag",
  mwst_satz: "USt-Satz",
  datum: "Rechnungsdatum",
  faelligkeit: "Fälligkeit",
  leistungsdatum: "Leistungsdatum",
  bezahlt_am: "Bezahlt am",
  bezahlter_betrag: "Bezahlter Betrag",
  kunde: "Kunde",
  abrechnungsart: "Abrechnungsart",
  notiz: "Notiz",
  mahnstufe: "Mahnstufe",
  zahlungen: "Zahlungen",
};

function diffInvoiceFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  writtenRow: Record<string, unknown>,
): { feld: string; alt: string; neu: string }[] {
  const out: { feld: string; alt: string; neu: string }[] = [];
  for (const key of Object.keys(writtenRow)) {
    if (!(key in FELD_LABEL)) continue;
    const oldVal = before[key];
    const newVal = after[key];
    const oldStr = normaliseAuditValue(oldVal);
    const newStr = normaliseAuditValue(newVal);
    if (oldStr === newStr) continue;
    out.push({ feld: FELD_LABEL[key], alt: oldStr, neu: newStr });
  }
  return out;
}

function normaliseAuditValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return `${v.length} Einträge`;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export interface InvoiceChangeEntry {
  id: string;
  feld: string;
  altWert: string | null;
  neuWert: string | null;
  akteur: string | null;
  createdAt: string;
}

/** Audit trail for a single invoice (newest first). */
export const listInvoiceChanges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { invoiceId: string }) => {
    if (!data?.invoiceId) throw new Error("invoiceId ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<InvoiceChangeEntry[]> => {
    const { data: rows, error } = await context.supabase
      .from("invoice_changes")
      .select("*")
      .eq("invoice_id", data.invoiceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const row = r as {
        id: string;
        feld: string;
        alt_wert: string | null;
        neu_wert: string | null;
        akteur: string | null;
        created_at: string;
      };
      return {
        id: row.id,
        feld: row.feld,
        altWert: row.alt_wert,
        neuWert: row.neu_wert,
        akteur: row.akteur,
        createdAt: row.created_at,
      };
    });
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
