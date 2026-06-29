// Server-Funktionen für die Administration (nur Admins).
// Liest Benutzer + Rollen und ändert Rollenzuweisungen sicher serverseitig.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/roles";

export interface BenutzerEintrag {
  id: string;
  email: string;
  name: string;
  rollen: AppRole[];
  erstellt: string;
}

const GUELTIGE_ROLLEN: AppRole[] = ["admin", "disposition", "finanz", "fahrer"];

export const listeBenutzer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BenutzerEintrag[]> => {
    const { data: eigeneAdminRolle, error: rollenFehler } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (rollenFehler || !eigeneAdminRolle) {
      throw new Error("Kein Zugriff: Diese Aktion ist Administratoren vorbehalten.");
    }

    const [{ data: profile }, { data: rollen }] = await Promise.all([
      context.supabase.from("profiles").select("id, email, name, created_at"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);

    const rollenMap = new Map<string, AppRole[]>();
    for (const r of rollen ?? []) {
      const list = rollenMap.get(r.user_id) ?? [];
      list.push(r.role as AppRole);
      rollenMap.set(r.user_id, list);
    }

    return (profile ?? []).map((p) => ({
      id: p.id,
      email: p.email ?? "",
      name: p.name ?? (p.email ? p.email.split("@")[0] : "Unbekannt"),
      rollen: rollenMap.get(p.id) ?? [],
      erstellt: p.created_at,
    }));
  });

export const setzeRolle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string; role: AppRole; aktion: "hinzufuegen" | "entfernen" }) => {
    if (!data?.userId) throw new Error("userId fehlt.");
    if (!GUELTIGE_ROLLEN.includes(data.role)) throw new Error("Ungültige Rolle.");
    if (data.aktion !== "hinzufuegen" && data.aktion !== "entfernen")
      throw new Error("Ungültige Aktion.");
    return data;
  })
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { data: istAdmin, error: rollenFehler } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (rollenFehler || istAdmin !== true) {
      throw new Error("Kein Zugriff: Diese Aktion ist Administratoren vorbehalten.");
    }

    // Letzte Admin-Rolle darf nicht entfernt werden.
    if (data.aktion === "entfernen" && data.role === "admin") {
      const { count } = await context.supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        throw new Error("Der letzte Administrator kann nicht entfernt werden.");
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.aktion === "hinzufuegen") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
