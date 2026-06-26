// Server-Funktionen für GHASI AI Gedächtnis & Aktivitätsprotokoll.
// Schreibzugriffe laufen serverseitig über den Service-Role-Client (RLS-Bypass).
import { createServerFn } from "@tanstack/react-start";

export interface MemoryInput {
  kategorie?: string;
  inhalt: string;
  quelle?: string;
  wichtigkeit?: number;
  bezug?: string;
}

export interface ProtokollInput {
  bereich: string;
  entitaet?: string;
  aktion: string;
  beschreibung: string;
  akteur?: string;
  metadaten?: Record<string, unknown>;
}

export const speichereGedaechtnis = createServerFn({ method: "POST" })
  .validator((data: MemoryInput) => {
    if (!data?.inhalt || typeof data.inhalt !== "string") {
      throw new Error("inhalt ist erforderlich");
    }
    return {
      kategorie: (data.kategorie ?? "beobachtung").slice(0, 60),
      inhalt: data.inhalt.slice(0, 2000),
      quelle: (data.quelle ?? "beobachtung").slice(0, 60),
      wichtigkeit: Math.min(5, Math.max(1, Math.round(data.wichtigkeit ?? 3))),
      bezug: data.bezug ? data.bezug.slice(0, 120) : null,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("ghasi_memory")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const protokolliere = createServerFn({ method: "POST" })
  .validator((data: ProtokollInput) => {
    if (!data?.bereich || !data?.aktion || !data?.beschreibung) {
      throw new Error("bereich, aktion und beschreibung sind erforderlich");
    }
    return {
      bereich: data.bereich.slice(0, 60),
      entitaet: data.entitaet ? data.entitaet.slice(0, 120) : null,
      aktion: data.aktion.slice(0, 60),
      beschreibung: data.beschreibung.slice(0, 500),
      akteur: (data.akteur ?? "Unternehmer").slice(0, 80),
      metadaten: (data.metadaten ?? null) as never,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("activity_log")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
