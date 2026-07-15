// P0.2 DOCUMENT_SERVER_BOUNDARY
// -----------------------------------------------------------------------------
// Zentraler serverseitiger Role Gate für alle Dokument-Endpunkte
// (list/signed-url/delete/upload/cleanup). Wird ausschließlich in
// *.server.ts- oder Handler-Kontexten geladen (dynamischer Import).
//
// - Rollen werden ausschließlich mit dem Admin-Client aus `user_roles`
//   gelesen. Niemals Client-Angaben zur Rolle vertrauen.
// - Erlaubt sind ausschließlich `admin`, `disposition`, `finanz`.
// - Fehlt die Rolle, wird eine 403 geworfen. Existenzinformation über
//   fremde Dokumente wird NICHT preisgegeben.
// - Bei DB-/Rollen-Störung wird eine generische 500 zurückgegeben.
// - `throw new Response(...)` erzeugt in TanStack Serverfunktionen echte
//   HTTP-Fehlerantworten, damit Runtime-Tests 401/403/500 sehen (kein 500
//   als versehentlicher Fallback für „Forbidden").
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DocumentRole = "admin" | "disposition" | "finanz";

const ERLAUBT = new Set<DocumentRole>(["admin", "disposition", "finanz"]);

/**
 * Erzwingt eine gültige Dokument-Rolle für den serverseitig authentifizierten
 * Benutzer. Wirf 403 wenn keine erlaubte Rolle vorliegt; wirft 500 nur bei
 * echter DB-Störung.
 */
export async function requireDocumentRole(userId: string): Promise<DocumentRole> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) {
    console.error("[documents-security] role lookup failed");
    throw new Response("Serverstörung.", { status: 500 });
  }
  const rollen = (data ?? []).map((r) => (r as { role: string }).role);
  const treffer = rollen.find((r): r is DocumentRole => ERLAUBT.has(r as DocumentRole));
  if (!treffer) {
    throw new Response("Keine Berechtigung.", { status: 403 });
  }
  return treffer;
}

/**
 * Serverseitig bestimmte, nicht personenbezogene Anzeigenamen für den
 * Uploader. Kein E-Mail-, Namens- oder ID-Leak.
 */
export function rolleAlsBereich(role: DocumentRole): string {
  switch (role) {
    case "admin":
      return "Administration";
    case "disposition":
      return "Disposition";
    case "finanz":
      return "Finanzen";
  }
}
