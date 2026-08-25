// GHASI AI MCP – feingranulare Scopes & rollenbasierte Autorisierung.
//
// Zwei unabhängige Schranken pro Werkzeug (Least Privilege, Constitution Art. 15):
//  1. OAuth-Scope: Trägt das Token bereichsspezifische `ghasi:*`-Scopes, muss der
//     Scope des Werkzeugs enthalten sein. Tokens ohne `ghasi:*`-Scope (der heutige
//     Standardfall: openid/email/profile) werden nicht künstlich blockiert –
//     dann entscheidet allein die Rolle.
//  2. Rolle: Die serverseitig aus `user_roles` gelesene höchste Rolle des
//     angemeldeten Nutzers muss den Scope besitzen. Client-Angaben werden ignoriert.
//
// Zusätzlich bleibt RLS die letzte Verteidigungslinie – dieses Modul erweitert
// Rechte nie, es verengt sie nur.
import type { ToolContext } from "@lovable.dev/mcp-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type AppRole, hoechsteRolle, ROLE_LABELS } from "@/lib/roles";
import { supabaseForUser } from "./supabase";

/** Feingranulare Werkzeug-Scopes (Bereich + Zugriffsart). */
export type McpScope =
  | "ghasi:orders.read"
  | "ghasi:orders.write"
  | "ghasi:orders.status"
  | "ghasi:drivers.read"
  | "ghasi:vehicles.read"
  | "ghasi:invoices.read"
  | "ghasi:invoices.write";

export const ALLE_SCOPES: McpScope[] = [
  "ghasi:orders.read",
  "ghasi:orders.write",
  "ghasi:orders.status",
  "ghasi:drivers.read",
  "ghasi:vehicles.read",
  "ghasi:invoices.read",
  "ghasi:invoices.write",
];

/**
 * Rolle → erlaubte Scopes. Spiegelt die Bereichsmatrix aus src/lib/roles.ts
 * und die RLS-Policies der Tabellen:
 * - Disposition: Betrieb (Aufträge/Fahrer/Fahrzeuge), keine Finanzen.
 * - Finanz: Rechnungen + lesender Auftragsbezug, keine operativen Schreibrechte.
 * - Fahrer: nur eigene Touren (per RLS) lesen und deren Status ändern.
 */
export const ROLLEN_SCOPES: Record<AppRole, McpScope[]> = {
  admin: ALLE_SCOPES,
  disposition: [
    "ghasi:orders.read",
    "ghasi:orders.write",
    "ghasi:orders.status",
    "ghasi:drivers.read",
    "ghasi:vehicles.read",
  ],
  finanz: ["ghasi:orders.read", "ghasi:invoices.read", "ghasi:invoices.write"],
  fahrer: ["ghasi:orders.read", "ghasi:orders.status", "ghasi:vehicles.read"],
};

export function rolleHatScope(role: AppRole | null | undefined, scope: McpScope): boolean {
  if (!role) return false;
  return (ROLLEN_SCOPES[role] ?? []).includes(scope);
}

/** Enthält das Token bereichsspezifische GHASI-Scopes? */
export function hatGhasiScopes(scopes: string[] | undefined): boolean {
  return (scopes ?? []).some((s) => s.startsWith("ghasi:"));
}

/**
 * Prüft den Token-Scope. Ohne `ghasi:*`-Scopes im Token gilt keine Scope-Schranke
 * (Rollenprüfung bleibt), mit `ghasi:*`-Scopes muss der Werkzeug-Scope enthalten sein.
 */
export function tokenHatScope(scopes: string[] | undefined, scope: McpScope): boolean {
  if (!hatGhasiScopes(scopes)) return true;
  return (scopes ?? []).includes(scope);
}

type ToolFehler = { content: { type: "text"; text: string }[]; isError: true };

const fehler = (text: string): ToolFehler => ({ content: [{ type: "text", text }], isError: true });

export type AuthzErgebnis =
  | { ok: true; supabase: SupabaseClient<Database>; role: AppRole; userId: string }
  | { ok: false; error: ToolFehler };

/** Liest die höchste Rolle des angemeldeten Nutzers serverseitig aus `user_roles`. */
async function leseRolle(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<AppRole | null> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) return null;
  return hoechsteRolle((data ?? []).map((r) => r.role) as AppRole[]);
}

/**
 * Einheitliche Torwächter-Funktion für alle MCP-Werkzeuge:
 * Authentifizierung → Token-Scope → Rolle → Rollen-Scope.
 */
export async function autorisiere(ctx: ToolContext, scope: McpScope): Promise<AuthzErgebnis> {
  if (!ctx.isAuthenticated()) return { ok: false, error: fehler("Nicht authentifiziert.") };
  const userId = ctx.getUserId();
  if (!userId) return { ok: false, error: fehler("Nicht authentifiziert.") };
  if (!tokenHatScope(ctx.getScopes(), scope)) {
    return {
      ok: false,
      error: fehler(`Der erteilte Zugriff umfasst den Scope "${scope}" nicht.`),
    };
  }
  const supabase = supabaseForUser(ctx);
  const role = await leseRolle(supabase, userId);
  if (!role) {
    return { ok: false, error: fehler("Diesem Konto ist keine Rolle zugewiesen.") };
  }
  if (!rolleHatScope(role, scope)) {
    return {
      ok: false,
      error: fehler(
        `Die Rolle "${ROLE_LABELS[role]}" darf dieses Werkzeug nicht nutzen (${scope}).`,
      ),
    };
  }
  return { ok: true, supabase, role, userId };
}
