// Serverseitige Protokollierung abgelehnter Dauerauftragsversuche.
// Jede fehlgeschlagene Validierung wird mit Zeitpunkt, Aktion, Grund und der
// strukturierten Feldliste in `recurring_rejections` festgehalten (Lesezugriff
// nur für Admins, RLS). Das Protokollieren darf die Fehlermeldung nie ersetzen.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { bereinigeEingaben } from "@/lib/recurring-rejection-detail";
import { kodiereFeldFehler, zuFeldFehlern, type FeldFehler } from "@/lib/recurring-validation";

export type AblehnungsAktion = "create" | "update" | "delete" | "generate";

function patientAus(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const direkt = typeof o["patient"] === "string" ? (o["patient"] as string) : null;
  const values = o["values"];
  const verschachtelt =
    values &&
    typeof values === "object" &&
    typeof (values as Record<string, unknown>)["patient"] === "string"
      ? ((values as Record<string, unknown>)["patient"] as string)
      : null;
  const name = (direkt ?? verschachtelt ?? "").trim();
  return name ? name.slice(0, 200) : null;
}

function zielIdAus(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const id = (data as Record<string, unknown>)["id"];
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

/** Schreibt einen Ablehnungseintrag; Fehler beim Schreiben werden verschluckt. */
export async function protokolliereAblehnung(
  supabase: SupabaseClient,
  aktion: AblehnungsAktion,
  data: unknown,
  felder: FeldFehler[],
): Promise<void> {
  try {
    const grund =
      felder
        .map((f) => `${f.label}: ${f.message}`)
        .join(" | ")
        .slice(0, 2000) || "Ungültige Dauerauftragsdaten.";
    await supabase.from("recurring_rejections").insert({
      aktion,
      ziel_id: zielIdAus(data),
      patient: patientAus(data),
      grund,
      felder,
      eingaben: bereinigeEingaben(data),
    });
  } catch {
    // Protokollierung ist best effort – die Validierungsmeldung hat Vorrang.
  }
}

/**
 * Validiert Eingaben, protokolliert Ablehnungen und wirft eine Meldung, die
 * die strukturierte Feldliste (`path` + `label` + `message`) transportiert.
 */
export async function parseOrLog<T>(
  supabase: SupabaseClient,
  aktion: AblehnungsAktion,
  schema: z.ZodType<T>,
  data: unknown,
  regeln?: (wert: T) => FeldFehler[],
): Promise<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const felder = zuFeldFehlern(parsed.error);
    await protokolliereAblehnung(supabase, aktion, data, felder);
    throw new Error(kodiereFeldFehler("Ungültige Dauerauftragsdaten.", felder));
  }
  const regelFehler = regeln?.(parsed.data) ?? [];
  if (regelFehler.length > 0) {
    await protokolliereAblehnung(supabase, aktion, data, regelFehler);
    throw new Error(kodiereFeldFehler("Ungültige Dauerauftragsdaten.", regelFehler));
  }
  return parsed.data;
}
