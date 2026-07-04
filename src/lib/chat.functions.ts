// Server-Funktionen für den GHASI-AI-Gesprächsverlauf (Threads).
// Lesen erfolgt clientseitig (öffentliche SELECT-Policy); Schreiben/Ändern/
// Löschen läuft hier serverseitig über den Service-Role-Client (RLS-Bypass).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const erstelleThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { titel?: string }) => ({
    titel: (data?.titel ?? "Neue Unterhaltung").slice(0, 120),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("chat_threads")
      .insert({ titel: data.titel })
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
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("chat_threads")
      .update({ titel: data.titel })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const loescheThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { id: string }) => {
    if (!data?.id) throw new Error("id ist erforderlich");
    return { id: data.id };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("chat_threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
