// Server functions for the persisted communication layer (Posteingang &
// Aktions-Center). RLS enforces admin/disposition read + write.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Konversation, KommEntwurf } from "@/lib/communication";
import {
  rowToKonversation,
  konversationToRow,
  rowToEntwurf,
  type ConversationRow,
  type DraftRow,
} from "@/lib/communication-shared";

/* ------------------------------------------------------------------ *
 * Conversations
 * ------------------------------------------------------------------ */

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Konversation[]> => {
    const { data, error } = await context.supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToKonversation(r as unknown as ConversationRow));
  });

export const updateConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: Partial<Konversation> }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<Konversation> => {
    const { data: updated, error } = await context.supabase
      .from("conversations")
      .update(konversationToRow(data.values) as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToKonversation(updated as unknown as ConversationRow);
  });

export const markAllConversationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("conversations")
      .update({ gelesen: true } as never)
      .eq("gelesen", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const seedConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ seeded: number }> => {
    const { count } = await context.supabase
      .from("conversations")
      .select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { INITIAL_KONVERSATIONEN } = await import("@/lib/communication");
    const rows = INITIAL_KONVERSATIONEN.map((k) => {
      const { id: _id, ...rest } = k;
      void _id;
      return konversationToRow(rest);
    });
    const { error } = await context.supabase.from("conversations").insert(rows as never);
    if (error) throw new Error(error.message);
    return { seeded: rows.length };
  });

/* ------------------------------------------------------------------ *
 * Drafts
 * ------------------------------------------------------------------ */

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KommEntwurf[]> => {
    const { data, error } = await context.supabase
      .from("communication_drafts")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowToEntwurf(r as unknown as DraftRow));
  });

export const upsertDrafts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { drafts: Record<string, unknown>[] }) => {
    if (!data || !Array.isArray(data.drafts)) throw new Error("drafts ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (data.drafts.length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("communication_drafts")
      .upsert(data.drafts as never, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; values: { nachricht?: string; status?: string } }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }): Promise<KommEntwurf> => {
    const values: Record<string, unknown> = {};
    if (data.values.nachricht !== undefined) values.nachricht = data.values.nachricht;
    if (data.values.status !== undefined) values.status = data.values.status;
    const { data: updated, error } = await context.supabase
      .from("communication_drafts")
      .update(values as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToEntwurf(updated as unknown as DraftRow);
  });
