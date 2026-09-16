// GHASI AI – Zentrale serverseitige Sicherheits-Helfer.
// Eine einzige Quelle der Wahrheit für: serverseitige Identitäts-/Rollenauflösung,
// Besitz-Prüfungen (Threads), Erkennung sensibler Inhalte und den
// rollenbeschränkten, request-scoped Fahrer-Wissenssnapshot.
//
// Server-only (Dateiname *.server.ts): darf den Service-Role-Client direkt
// importieren. NICHT aus Client-Komponenten importieren.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type AppRole, hoechsteRolle } from "@/lib/roles";

/** Generische Autorisierungsmeldung – verrät niemals, ob eine fremde Ressource existiert. */
export const KEIN_ZUGRIFF = "Kein Zugriff auf diese Ressource.";
/** Einheitliche Fehlermeldung für rollenbasierte Werkzeug-Sperren. */
export const ROLLE_FEHLT = "Dafür fehlt deiner Rolle die Berechtigung.";

export interface ServerActor {
  userId: string;
  role: AppRole | null;
  /** Anzeigename für Protokolle (aus profiles), niemals aus Client-Eingaben. */
  name: string;
  /** drivers.id, falls dieser Auth-Nutzer stabil mit einem Fahrer verknüpft ist. */
  driverId: string | null;
}

/**
 * Löst Rolle, Anzeigename und Fahrer-Verknüpfung serverseitig aus der Datenbank auf.
 * Client-gelieferte Rollen/Namen/IDs werden bewusst ignoriert.
 */
export async function resolveActor(userId: string): Promise<ServerActor> {
  const [rollenRes, profilRes, fahrerRes] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("profiles").select("name, email").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("drivers").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  const role = hoechsteRolle((rollenRes.data ?? []).map((r) => r.role) as AppRole[]);
  const name = profilRes.data?.name || profilRes.data?.email || "Unbekannt";
  return { userId, role, name, driverId: fahrerRes.data?.id ?? null };
}

/**
 * Löst Anzeigenamen für mehrere Nutzer-IDs in einem Rutsch auf (z. B. für
 * Änderungsprotokolle/Audit-Listen) – ein Query statt `resolveActor()` pro Zeile.
 *
 * Bewusst fehlertolerant (wie `logActivitySafe`): die Namensauflösung ist eine
 * Anreicherung, kein Kernbestandteil. Schlägt sie fehl (z. B. Admin-Client
 * vorübergehend nicht erreichbar), gibt die Funktion eine leere Map zurück,
 * statt die komplette Audit-Liste mitzureißen – die Aufrufer zeigen dann die
 * rohe Nutzer-ID/"Unbekannt" statt des Namens, aber die Liste bleibt sichtbar.
 */
export async function resolveActorNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email")
      .in("id", unique);
    if (error) throw new Error(error.message);
    const map = new Map<string, string>();
    for (const row of data ?? []) {
      map.set(row.id as string, (row.name as string) || (row.email as string) || "Unbekannt");
    }
    return map;
  } catch (e) {
    console.error("[resolveActorNames] Namensauflösung fehlgeschlagen:", e);
    return new Map();
  }
}

/**
 * Prüft serverseitig, ob ein Thread dem angegebenen Nutzer gehört.
 * Gibt bei fremden UND nicht existierenden Threads gleichermaßen false zurück,
 * damit die Existenz fremder Threads nicht preisgegeben wird.
 */
export async function threadGehoert(threadId: string, userId: string): Promise<boolean> {
  if (!threadId) return false;
  const { data } = await supabaseAdmin
    .from("chat_threads")
    .select("user_id")
    .eq("id", threadId)
    .maybeSingle();
  return !!data && data.user_id === userId;
}

// Muster für Inhalte, die niemals ins Langzeitgedächtnis übernommen werden dürfen:
// Zugangsdaten, Bank-/Zahlungsdaten und unnötige Gesundheitsdaten (Constitution Art. 8/15).
const SENSIBLE_MUSTER: RegExp[] = [
  /\b(passwort|password|kennwort|passcode|pin|otp|2fa|token|api[- ]?key|secret)\b/i,
  /\b(iban|bic|kontonummer|kartennummer|kreditkart\w*|cvv|cvc|swift)\b/i,
  /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/, // Kartennummer-artige Zahlenfolge
  /\bDE\d{2}[ ]?\d{4}[ ]?\d{4}[ ]?\d{4}[ ]?\d{4}[ ]?\d{2}\b/i, // IBAN (DE)
  /\b(diagnose|blutgruppe|hiv|aids|schwanger\w*|psychiatr\w*|krebs|medikament\w*|krankheitsbild)\b/i,
];

/** Erkennt Inhalte, die aus Sicherheitsgründen nicht dauerhaft gespeichert werden dürfen. */
export function istSensibel(text: string): boolean {
  return SENSIBLE_MUSTER.some((r) => r.test(text));
}

const EUR = (n: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

/**
 * Baut einen request-scoped Wissenssnapshot für die Rolle FAHRER.
 * Enthält ausschließlich: heutige zugewiesene Fahrten, das eigene Fahrzeug und
 * die eigene Beschäftigungs-/Rechtsinfo. Keine anderen Fahrer, keine Finanzen,
 * keine fremden Patienten, keine unternehmensweiten Kennzahlen.
 * Filtert Fahrten ausschließlich über orders.fahrer_user_id (keine Namensabgleiche).
 */
export async function buildDriverSnapshot(
  userId: string,
  driverId: string | null,
): Promise<string> {
  const heute = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# Dein Fahrer-Kontext (Stand jetzt)`);

  if (!driverId) {
    lines.push(
      "Dein Konto ist noch keinem Fahrerdatensatz zugeordnet. Es liegen dir daher keine " +
        "zugewiesenen Fahrten oder ein Fahrzeug vor. Bitte die Disposition um Verknüpfung.",
    );
    return lines.join("\n");
  }

  const { data: fahrer } = await supabaseAdmin
    .from("drivers")
    .select(
      "name, nummer, status, fahrzeug, vertragsart, beschaeftigungsart, arbeitszeiten, urlaubstage, krankheitstage, monatsbrutto, p_schein_gueltig_bis",
    )
    .eq("id", driverId)
    .maybeSingle();

  // Heutige, diesem Fahrer zugewiesene Aufträge – strikt über fahrer_user_id.
  const { data: fahrten } = await supabaseAdmin
    .from("orders")
    .select(
      "nummer, patient, transportart, status, abholort, zielort, termin, mobilitaet, begleitperson",
    )
    .eq("fahrer_user_id", userId)
    .gte("termin", `${heute}T00:00:00`)
    .lte("termin", `${heute}T23:59:59`)
    .order("termin", { ascending: true });

  lines.push(`\n## Heutige zugewiesene Fahrten (${fahrten?.length ?? 0})`);
  if (fahrten && fahrten.length > 0) {
    for (const a of fahrten) {
      const zeit = new Date(a.termin).toLocaleTimeString("de-DE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      lines.push(
        `- ${zeit} ${a.nummer}: ${a.patient}, ${a.transportart}, ${a.abholort} → ${a.zielort}, ` +
          `Status ${a.status}, Mobilität ${a.mobilitaet ?? "—"}, Begleitperson ${a.begleitperson ? "Ja" : "Nein"}.`,
      );
    }
  } else {
    lines.push("Für heute sind dir keine Fahrten zugewiesen.");
  }

  if (fahrer?.fahrzeug) {
    const { data: fzg } = await supabaseAdmin
      .from("vehicles")
      .select("kennzeichen, marke, modell, typ, status, tankstand, tuev_bis, naechste_wartung")
      .eq("kennzeichen", fahrer.fahrzeug)
      .maybeSingle();
    lines.push(`\n## Dein Fahrzeug`);
    if (fzg) {
      lines.push(
        `- ${fzg.kennzeichen} ${fzg.marke} ${fzg.modell} (${fzg.typ}): ${fzg.status}, ` +
          `Tank ${fzg.tankstand}%, TÜV ${fzg.tuev_bis ?? "—"}, nächste Wartung ${fzg.naechste_wartung ?? "—"}.`,
      );
    } else {
      lines.push(`- ${fahrer.fahrzeug}`);
    }
  }

  if (fahrer) {
    lines.push(`\n## Deine Beschäftigung (nur du)`);
    lines.push(
      `- ${fahrer.name} (${fahrer.nummer}): ${fahrer.vertragsart}, Beschäftigungsart ${fahrer.beschaeftigungsart}, ` +
        `Arbeitszeiten ${fahrer.arbeitszeiten}, Urlaubstage ${fahrer.urlaubstage}, Krankheitstage ${fahrer.krankheitstage}, ` +
        `Monatsbrutto ${EUR(Number(fahrer.monatsbrutto))}, P-Schein gültig bis ${fahrer.p_schein_gueltig_bis ?? "—"}.`,
    );
  }

  return lines.join("\n");
}
