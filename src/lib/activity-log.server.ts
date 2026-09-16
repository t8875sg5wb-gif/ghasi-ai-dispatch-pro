// Server-only Helfer für das Aktivitätsprotokoll.
//
// SICHERHEIT / GRUND:
// - `public.activity_log` darf ausschließlich über die Service-Rolle beschrieben
//   werden (INSERT wurde `anon`/`authenticated` entzogen). Ein Insert über den
//   Nutzer-Client schlägt daher immer fehl.
// - Akteur (Name + Rolle) und `user_id` werden IMMER serverseitig aus der
//   Identität abgeleitet – Client-Werte werden ignoriert.
//
// Diese Datei ist per `.server.ts`-Namenskonvention vom Client-Bundle
// ausgeschlossen und wird in `*.functions.ts` dynamisch im Handler importiert.

export interface ActivityLogEntry {
  bereich: string;
  entitaet?: string | null;
  aktion: string;
  beschreibung: string;
  metadaten?: Record<string, unknown> | null;
}

export function activityDedupeKey(entry: ActivityLogEntry): string | null {
  const raw = entry.metadaten?.dedupeKey;
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  return key ? key.slice(0, 160) : null;
}

/**
 * Schreibt einen Protokolleintrag mit der Service-Rolle.
 * Wirft bei Fehlern – Aufrufer, für die das Protokoll nur eine Nebenwirkung
 * ist, fangen den Fehler selbst ab (siehe `logActivitySafe`).
 */
export async function writeActivityLog(entry: ActivityLogEntry, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { resolveActor } = await import("@/lib/ghasi-security.server");

  const actor = await resolveActor(userId);
  const akteur = `${actor.name}${actor.role ? ` (${actor.role})` : ""}`.slice(0, 80);
  const dedupeKey = activityDedupeKey(entry);

  // Bewusst OHNE Zeitfenster: ein `dedupeKey` markiert einen konkreten,
  // unveraenderten Zustand (z. B. "Auftrag X seit Stufe Y unzugewiesen").
  // Mit einem 24h-Fenster wurde derselbe, seit Wochen unveraenderte Zustand
  // bei jedem Seitenaufruf nach Ablauf des Fensters erneut protokolliert –
  // das Aktivitaetsprotokoll fuellte sich mit taeglichen Duplikaten fuer
  // Auftraege, die schon seit Monaten unzugewiesen sind. Eine echte
  // Eskalation (z. B. gelb -> rot) hat ohnehin einen eigenen `dedupeKey`
  // (die Stufe ist Teil der ID) und wird weiterhin korrekt neu protokolliert.
  if (dedupeKey) {
    const { data: existing, error: dedupeError } = await supabaseAdmin
      .from("activity_log")
      .select("id, created_at")
      .eq("user_id", userId)
      .eq("bereich", entry.bereich.slice(0, 60))
      .eq("aktion", entry.aktion.slice(0, 60))
      .contains("metadaten", { dedupeKey })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (dedupeError) console.error("[activity_log] Dedupe-Prüfung fehlgeschlagen:", dedupeError);
    if (existing) return existing;
  }

  const { data: row, error } = await supabaseAdmin
    .from("activity_log")
    .insert({
      bereich: entry.bereich.slice(0, 60),
      entitaet: entry.entitaet ? entry.entitaet.slice(0, 120) : null,
      aktion: entry.aktion.slice(0, 60),
      beschreibung: entry.beschreibung.slice(0, 500),
      metadaten: (entry.metadaten ?? null) as never,
      akteur,
      user_id: userId,
    } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

/**
 * Variante für Nebenwirkungs-Protokolle: Der eigentliche Vorgang ist bereits
 * gespeichert, ein Protokollfehler darf die Antwort nicht kippen – aber auch
 * nicht still verschwinden.
 */
export async function logActivitySafe(entry: ActivityLogEntry, userId: string) {
  try {
    await writeActivityLog(entry, userId);
  } catch (e) {
    console.error("[activity_log] Protokolleintrag fehlgeschlagen:", e);
  }
}
