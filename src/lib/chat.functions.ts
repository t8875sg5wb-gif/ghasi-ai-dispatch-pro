// Server-Funktionen für den GHASI-AI-Gesprächsverlauf (Threads).
// Lesen erfolgt clientseitig über RLS: Nutzer sehen nur eigene Threads.
// Schreiben läuft serverseitig mit der verifizierten Nutzer-Session; RLS plus
// expliziter user_id-Filter erzwingen Besitz. Kein Service-Role-Key erforderlich.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KEIN_ZUGRIFF = "Kein Zugriff auf diese Unterhaltung.";

export const erstelleThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { titel?: string }) => ({
    titel: (data?.titel ?? "Neue Unterhaltung").slice(0, 120),
  }))
  .handler(async ({ data, context }) => {
    // user_id wird IMMER serverseitig gesetzt – nie aus Client-Daten übernommen.
    const { data: row, error } = await context.supabase
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
    // Besitz-gebundene Aktualisierung: nur der eigene Thread wird getroffen.
    // Affected-row-Check verhindert stilles Gelingen bei fremden Threads.
    const { data: rows, error } = await context.supabase
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
    const { data: rows, error } = await context.supabase
      .from("chat_threads")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) throw new Error(KEIN_ZUGRIFF);
    return { ok: true };
  });
