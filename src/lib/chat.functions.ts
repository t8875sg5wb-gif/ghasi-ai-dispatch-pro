// Server-Funktionen für den GHASI-AI-Gesprächsverlauf (Threads).
// Lesen erfolgt clientseitig (RLS: Nutzer sehen nur eigene Threads).
// Erstellen/Umbenennen/Löschen läuft serverseitig über den Service-Role-Client
// (RLS-Bypass) – deshalb wird der Besitz hier bei JEDER Mutation serverseitig
// gegen context.userId geprüft. Fremde/nicht existierende Threads werden mit
// derselben generischen Meldung abgewiesen (keine Existenz-Preisgabe).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KEIN_ZUGRIFF = "Kein Zugriff auf diese Unterhaltung.";

export const erstelleThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { titel?: string }) => ({
    titel: (data?.titel ?? "Neue Unterhaltung").slice(0, 120),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // user_id wird IMMER serverseitig gesetzt – nie aus Client-Daten übernommen.
    const { data: row, error } = await supabaseAdmin
      .from("chat_threads")
      .insert({ titel: data.titel, user_id: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const benenneThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string; titel: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return { id: data.id, titel: (data.titel ?? "Unterhaltung").slice(0, 120) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Besitz-gebundene Aktualisierung: nur der eigene Thread wird getroffen.
    // Affected-row-Check verhindert stilles Gelingen bei fremden Threads.
    const { data: rows, error } = await supabaseAdmin
      .from("chat_threads")
      .update({ titel: data.titel })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error(KEIN_ZUGRIFF);
    return { ok: true };
  });

export const loescheThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return { id: data.id };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("chat_threads")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error(KEIN_ZUGRIFF);
    return { ok: true };
  });
