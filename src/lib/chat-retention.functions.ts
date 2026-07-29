// Löschkonzept für KI-/Chatdaten (Admin-only, manuell ausgelöst).
//
// Die Frist stammt aus `company_settings.chat_retention_months` und ist eine
// BETRIEBLICHE Einstellung. Sie ist bewusst NICHT von `AUFBEWAHRUNG_JAHRE`
// (gesetzliche GoBD-Mindestaufbewahrung für Belege/Bücher/Lohnkonten)
// abgeleitet – das wären zwei fachlich völlig verschiedene Dinge.
//
// `ai_audit_log` wird hier bewusst NICHT gelöscht: ob und wie lange der
// KI-Prüfpfad aufbewahrt werden muss, ist eine offene rechtliche Frage
// (Nachweisbarkeit/Prüfzwecke). Lieber aufbewahren als raten.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface RetentionErgebnis {
  /** Angewandte Frist in Monaten. */
  monate: number;
  /** Stichtag (ISO); alles Ältere wurde gelöscht. */
  stichtag: string;
  geloeschteNachrichten: number;
  geloeschteThreads: number;
  geloeschteErinnerungen: number;
  /** Bewusst ausgenommen – siehe Modulkommentar. */
  auditLogAusgenommen: true;
}

export const bereinigeAltenChatverlauf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RetentionErgebnis> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveActor } = await import("@/lib/ghasi-security.server");
    const { logActivitySafe } = await import("@/lib/activity-log.server");

    const actor = await resolveActor(context.userId);
    if (actor.role !== "admin") {
      throw new Error("Nur Administratoren dürfen den Chatverlauf bereinigen.");
    }

    const { data: settings } = await supabaseAdmin
      .from("company_settings")
      .select("chat_retention_months")
      .eq("singleton", 1)
      .maybeSingle();

    const monate = Math.min(
      120,
      Math.max(
        1,
        Math.round(
          Number(
            (settings as { chat_retention_months?: number } | null)?.chat_retention_months ?? 12,
          ),
        ),
      ),
    );

    const stichtagDate = new Date();
    stichtagDate.setMonth(stichtagDate.getMonth() - monate);
    const stichtag = stichtagDate.toISOString();

    // 1) Alte Threads ermitteln (Nachrichten hängen daran).
    const { data: alteThreads, error: threadFehler } = await supabaseAdmin
      .from("chat_threads")
      .select("id")
      .lt("updated_at", stichtag);
    if (threadFehler) throw new Error(threadFehler.message);
    const threadIds = (alteThreads ?? []).map((t) => t.id as string);

    let geloeschteNachrichten = 0;
    let geloeschteThreads = 0;

    if (threadIds.length > 0) {
      const { data: msgs, error: msgFehler } = await supabaseAdmin
        .from("chat_messages")
        .delete()
        .in("thread_id", threadIds)
        .select("id");
      if (msgFehler) throw new Error(msgFehler.message);
      geloeschteNachrichten = msgs?.length ?? 0;

      const { data: threads, error: delFehler } = await supabaseAdmin
        .from("chat_threads")
        .delete()
        .in("id", threadIds)
        .select("id");
      if (delFehler) throw new Error(delFehler.message);
      geloeschteThreads = threads?.length ?? 0;
    }

    // 2) Abgelaufene bzw. überalterte Erinnerungen entfernen.
    const { data: abgelaufen, error: memFehler } = await supabaseAdmin
      .from("ghasi_memory")
      .delete()
      .or(`expires_at.lt.${new Date().toISOString()},created_at.lt.${stichtag}`)
      .select("id");
    if (memFehler) throw new Error(memFehler.message);
    const geloeschteErinnerungen = abgelaufen?.length ?? 0;

    await logActivitySafe(
      {
        bereich: "Datenschutz",
        entitaet: null,
        aktion: "Chatverlauf bereinigt",
        beschreibung: `Chatdaten älter als ${monate} Monate gelöscht: ${geloeschteThreads} Unterhaltungen, ${geloeschteNachrichten} Nachrichten, ${geloeschteErinnerungen} Erinnerungen.`,
        metadaten: { monate, stichtag },
      },
      context.userId,
    );

    return {
      monate,
      stichtag,
      geloeschteNachrichten,
      geloeschteThreads,
      geloeschteErinnerungen,
      auditLogAusgenommen: true,
    };
  });
