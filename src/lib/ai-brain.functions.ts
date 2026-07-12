// Server function: GHASI AI executive analysis powered by Lovable AI.
// Builds a live context from the central AI Brain and asks the model for a
// concise executive briefing (situation, opportunities, risks, next steps).
// Read-only & advisory — the AI never executes or sends anything.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ExecutiveAnalysis {
  lageeinschaetzung: string;
  chancen: string[];
  risiken: string[];
  naechsteSchritte: string[];
  fehler?: string;
}

export const generateExecutiveAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExecutiveAnalysis> => {
    // SICHERHEIT: Das Executive-Briefing bündelt operative UND Finanzdaten und
    // ist daher ausschließlich Administratoren vorbehalten (Least Privilege).
    const { resolveActor } = await import("@/lib/ghasi-security.server");
    const { role } = await resolveActor(context.userId);
    if (role !== "admin") {
      return {
        lageeinschaetzung: "",
        chancen: [],
        risiken: [],
        naechsteSchritte: [],
        fehler: "Dafür fehlt deiner Rolle die Berechtigung.",
      };
    }
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        lageeinschaetzung: "",
        chancen: [],
        risiken: [],
        naechsteSchritte: [],
        fehler: "KI nicht verfügbar (Konfiguration fehlt).",
      };
    }

    const { generateText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { buildBrainSnapshot, computeInsights, computePrognosen } =
      await import("@/lib/ai-brain");
    const { buildKnowledgeSnapshot } = await import("@/lib/ghasi-knowledge");
    const { buildCeoSnapshot } = await import("@/lib/ceo-intelligence");
    const { hydrateServerMirrors } = await import("@/lib/server-mirror.server");

    // AI Brain: load real persisted data into the in-memory mirrors first so the
    // briefing is built from database data, never demo seeds.
    await hydrateServerMirrors();

    const insights = computeInsights()
      .slice(0, 8)
      .map((i) => `- [${i.wirkung}] ${i.titel}: ${i.erklaerung}`)
      .join("\n");
    const prognose = computePrognosen();

    const kontext = `${buildBrainSnapshot()}

## Erkannte Optimierungspotenziale (regelbasiert)
${insights || "Keine."}

## Prognose
Erwarteter Wochenumsatz: ${prognose.zusammenfassung.umsatzWocheGesamt} €.
Erwarteter Engpasstag: ${prognose.zusammenfassung.erwarteterEngpassTag}.
Fahrer-Lücke Spitze: ${prognose.zusammenfassung.fahrerLueckeSpitze}.
Wartungen nächste 30 Tage: ${prognose.zusammenfassung.wartungenNaechste30Tage}.

${buildCeoSnapshot()}

${buildKnowledgeSnapshot("admin")}`;

    const toStrings = (v: unknown): string[] =>
      Array.isArray(v)
        ? v
            .map((x) => String(x))
            .filter(Boolean)
            .slice(0, 5)
        : [];

    try {
      const provider = createLovableAiGatewayProvider(apiKey);
      const result = await generateText({
        model: provider("google/gemini-2.5-flash"),
        system:
          "Du bist GHASI AI, der digitale Geschäftsführer eines Krankentransportunternehmens. " +
          "Analysiere die bereitgestellten Live-Daten und antworte ausschließlich auf Deutsch, präzise und unternehmerisch. " +
          "Du gibst nur Empfehlungen – du führst nichts aus und versendest nichts. " +
          "Antworte AUSSCHLIESSLICH mit gültigem JSON ohne Code-Fences, exakt in diesem Format: " +
          '{"lageeinschaetzung": string, "chancen": string[], "risiken": string[], "naechsteSchritte": string[]}. ' +
          "lageeinschaetzung sind 2–4 Sätze zur Gesamtlage. Die Arrays enthalten je 3–5 kurze, konkrete Einträge (je 1 Satz).",
        prompt: `Erstelle ein kompaktes Executive-Briefing auf Basis dieser aktuellen Unternehmensdaten und gib es als JSON zurück:\n\n${kontext}`,
      });

      // Tolerantes Parsen: Code-Fences entfernen, JSON-Block extrahieren.
      const raw = result.text
        .trim()
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Keine JSON-Antwort erhalten.");
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;

      return {
        lageeinschaetzung:
          typeof parsed.lageeinschaetzung === "string" ? parsed.lageeinschaetzung : "",
        chancen: toStrings(parsed.chancen),
        risiken: toStrings(parsed.risiken),
        naechsteSchritte: toStrings(parsed.naechsteSchritte),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[generateExecutiveAnalysis] error:", message);
      let fehler = "Die KI-Analyse konnte nicht erstellt werden – bitte erneut versuchen.";
      if (/429|rate limit/i.test(message))
        fehler = "KI-Limit erreicht – bitte in Kürze erneut versuchen.";
      else if (/402|credit/i.test(message))
        fehler = "KI-Guthaben aufgebraucht – bitte Credits aufladen.";
      return { lageeinschaetzung: "", chancen: [], risiken: [], naechsteSchritte: [], fehler };
    }
  },
);
