// Server-Funktionen für GHASI AI Gedächtnis & Aktivitätsprotokoll.
// Schreibzugriffe laufen serverseitig über den Service-Role-Client (RLS-Bypass).
//
// SICHERHEIT:
// - Akteur/Rolle/Nutzer-ID werden IMMER serverseitig aufgelöst (nie aus dem Client).
// - Gedächtnis wird niemals automatisch gespeichert: Diese Funktion ist der
//   explizite Bestätigungsschritt (Nutzer bestätigt -> Server speichert).
// - Erinnerungen sind typisiert und besitzen einen Besitzer; Unternehmensregeln
//   dürfen nur Administratoren anlegen.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Erlaubte, typisierte Erinnerungsarten. */
export const MEMORY_TYPEN = [
  "personal",
  "company_rule",
  "professional_correction",
  "temporary",
  "observation",
] as const;
export type MemoryTyp = (typeof MEMORY_TYPEN)[number];

export interface MemoryInput {
  typ: MemoryTyp;
  kategorie?: string;
  inhalt: string;
  quelle?: string;
  wichtigkeit?: number;
  bezug?: string;
  /** Nur für typ="temporary": Ablauf in Tagen (1–90). */
  ablaufTage?: number;
}

export interface ProtokollInput {
  bereich: string;
  entitaet?: string;
  aktion: string;
  beschreibung: string;
  /** akteur wird serverseitig gesetzt und aus Client-Eingaben ignoriert. */
  akteur?: string;
  metadaten?: Record<string, unknown>;
}

/**
 * Speichert eine Erinnerung – ausschließlich nach ausdrücklicher Bestätigung
 * durch den Nutzer (kein Auto-Save). Enthält Besitz-, Typ- und Inhaltsprüfungen.
 */
export const speichereGedaechtnis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: MemoryInput) => {
    if (!data?.inhalt || typeof data.inhalt !== "string") {
      throw new Error("inhalt ist erforderlich");
    }
    const typ = (data.typ ?? "personal") as MemoryTyp;
    if (!MEMORY_TYPEN.includes(typ)) {
      throw new Error("Ungültiger Erinnerungstyp.");
    }
    return {
      typ,
      kategorie: (data.kategorie ?? "beobachtung").slice(0, 60),
      inhalt: data.inhalt.slice(0, 2000),
      quelle: (data.quelle ?? "bestaetigt").slice(0, 60),
      wichtigkeit: Math.min(5, Math.max(1, Math.round(data.wichtigkeit ?? 3))),
      bezug: data.bezug ? data.bezug.slice(0, 120) : null,
      ablaufTage:
        typ === "temporary" ? Math.min(90, Math.max(1, Math.round(data.ablaufTage ?? 7))) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveActor, istSensibel } = await import("@/lib/ghasi-security.server");

    // Offensichtlich sensible Inhalte niemals dauerhaft speichern (Art. 8/15).
    if (istSensibel(data.inhalt)) {
      throw new Error(
        "Dieser Inhalt enthält sensible Daten (z.B. Zugangsdaten, Bankdaten oder unnötige " +
          "Gesundheitsdaten) und darf nicht ins Langzeitgedächtnis übernommen werden.",
      );
    }

    const actor = await resolveActor(context.userId);

    // Unternehmensregeln dürfen nur Administratoren anlegen (und gelten sofort als genehmigt).
    if (data.typ === "company_rule" && actor.role !== "admin") {
      throw new Error("Nur Administratoren dürfen Unternehmensregeln anlegen.");
    }

    const expires_at =
      data.ablaufTage != null
        ? new Date(Date.now() + data.ablaufTage * 86_400_000).toISOString()
        : null;

    const { data: row, error } = await supabaseAdmin
      .from("ghasi_memory")
      .insert({
        typ: data.typ,
        kategorie: data.kategorie,
        inhalt: data.inhalt,
        quelle: data.quelle,
        wichtigkeit: data.wichtigkeit,
        bezug: data.bezug,
        user_id: context.userId,
        genehmigt: data.typ === "company_rule",
        expires_at,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const protokolliere = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ProtokollInput) => {
    if (!data?.bereich || !data?.aktion || !data?.beschreibung) {
      throw new Error("bereich, aktion und beschreibung sind erforderlich");
    }
    return {
      bereich: data.bereich.slice(0, 60),
      entitaet: data.entitaet ? data.entitaet.slice(0, 120) : null,
      aktion: data.aktion.slice(0, 60),
      beschreibung: data.beschreibung.slice(0, 500),
      metadaten: (data.metadaten ?? null) as never,
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveActor } = await import("@/lib/ghasi-security.server");

    // Akteur wird serverseitig aus der Identität abgeleitet – Client-Werte werden ignoriert.
    const actor = await resolveActor(context.userId);
    const akteur = `${actor.name}${actor.role ? ` (${actor.role})` : ""}`.slice(0, 80);

    const { data: row, error } = await supabaseAdmin
      .from("activity_log")
      .insert({ ...data, akteur })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
