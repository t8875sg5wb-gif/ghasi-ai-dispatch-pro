// Server function: AI Verordnungs-Scan (Muster 4 – Verordnung einer
// Krankenbeförderung). Takes a photo/scan (base64) and extracts the
// billing-relevant fields via the Lovable AI gateway. Read-only extraction –
// nothing is persisted here; the UI confirms every field before saving.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  emptyScan,
  type ScanResult,
  type ScanTransportart,
  type ScannedVerordnung,
} from "@/lib/verordnung-scan-shared";

interface ScanInput {
  imageBase64: string; // raw base64 (no data: prefix) or full data URL
  mimeType: string;
}

const SYSTEM = `Du bist ein Extraktions-Assistent für deutsche „Verordnung einer Krankenbeförderung" (Muster 4).
Lies das Bild sorgfältig und extrahiere ausschließlich die gefragten Felder. Rate niemals – wenn ein Feld
nicht sicher lesbar ist, gib null zurück. Antworte AUSSCHLIESSLICH mit gültigem JSON ohne Code-Fences,
exakt in diesem Format:
{"patientName": string|null, "geburtsdatum": string|null, "krankenkasse": string|null,
 "versichertennummer": string|null, "transportart": "Rollstuhl"|"Tragestuhl"|"liegend"|"sitzend"|null,
 "dauerfahrt": boolean|null, "gueltigVon": string|null, "gueltigBis": string|null, "arzt": string|null}
Regeln:
- Datumsangaben als ISO (YYYY-MM-DD) wenn erkennbar, sonst null.
- transportart: "liegend" für Liegendtransport/KTW-Liege, "Rollstuhl" bzw. "Tragestuhl" für Sitz-/Rollstuhl,
  "sitzend" für gehfähigen Sitztransport im Taxi/Mietwagen.
- dauerfahrt: true wenn eine Serien-/Dauerbehandlung (z. B. Dialyse, Bestrahlung, Chemo) oder ein
  Zeitraum mit mehreren Fahrten angekreuzt ist, sonst false.
- arzt: Name/Praxis des verordnenden Arztes.`;

export const scanVerordnung = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: ScanInput) => {
    if (!data?.imageBase64) throw new Error("imageBase64 ist erforderlich");
    if (!data?.mimeType) throw new Error("mimeType ist erforderlich");
    return data;
  })
  .handler(async ({ data }): Promise<ScanResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { ok: false, data: emptyScan(), fehler: "KI nicht verfügbar (Konfiguration fehlt)." };
    }

    const dataUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:${data.mimeType};base64,${data.imageBase64}`;

    try {
      const { generateText } = await import("ai");
      const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
      const provider = createLovableAiGatewayProvider(apiKey);

      const result = await generateText({
        model: provider("google/gemini-2.5-flash"),
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extrahiere die Felder aus dieser Verordnung und gib nur das JSON zurück.",
              },
              { type: "image", image: dataUrl },
            ],
          },
        ],
      });

      const raw = result.text
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Keine JSON-Antwort erhalten.");
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

      const str = (v: unknown): string | null =>
        typeof v === "string" && v.trim() ? v.trim() : null;
      const art = ((): ScanTransportart | null => {
        const v = str(parsed.transportart);
        return v === "Rollstuhl" || v === "Tragestuhl" || v === "liegend" || v === "sitzend"
          ? v
          : null;
      })();

      const extracted: ScannedVerordnung = {
        patientName: str(parsed.patientName),
        geburtsdatum: str(parsed.geburtsdatum),
        krankenkasse: str(parsed.krankenkasse),
        versichertennummer: str(parsed.versichertennummer),
        transportart: art,
        dauerfahrt: typeof parsed.dauerfahrt === "boolean" ? parsed.dauerfahrt : null,
        gueltigVon: str(parsed.gueltigVon),
        gueltigBis: str(parsed.gueltigBis),
        arzt: str(parsed.arzt),
      };

      return { ok: true, data: extracted };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[scanVerordnung] error:", message);
      let fehler = "Die Verordnung konnte nicht automatisch erkannt werden – bitte manuell erfassen.";
      if (/429|rate limit/i.test(message)) fehler = "KI-Limit erreicht – bitte in Kürze erneut versuchen.";
      else if (/402|credit/i.test(message)) fehler = "KI-Guthaben aufgebraucht – bitte Credits aufladen.";
      return { ok: false, data: emptyScan(), fehler };
    }
  });
