// Server function: GHASI AI executive analysis powered by Lovable AI.
// Builds a live context from the central AI Brain and asks the model for a
// concise executive briefing (situation, opportunities, risks, next steps).
// Read-only & advisory — the AI never executes or sends anything.
import { createServerFn } from "@tanstack/react-start";

export interface ExecutiveAnalysis {
  lageeinschaetzung: string;
  chancen: string[];
  risiken: string[];
  naechsteSchritte: string[];
  fehler?: string;
}

export const generateExecutiveAnalysis = createServerFn({ method: "POST" }).handler(
  async (): Promise<ExecutiveAnalysis> => {
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

    const { generateText, Output } = await import("ai");
    const { z } = await import("zod");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { buildBrainSnapshot, computeInsights, computePrognosen } = await import("@/lib/ai-brain");
    const { buildKnowledgeSnapshot } = await import("@/lib/ghasi-knowledge");

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

${buildKnowledgeSnapshot()}`;

    const schema = z.object({
      lageeinschaetzung: z
        .string()
        .describe("2–4 Sätze Gesamtlage des Unternehmens, sachlich wie ein Betriebsleiter, in Markdown."),
      chancen: z.array(z.string()).max(5).describe("Konkrete Chancen/Gewinnpotenziale, je 1 Satz."),
      risiken: z.array(z.string()).max(5).describe("Konkrete Risiken/Warnungen, je 1 Satz."),
      naechsteSchritte: z.array(z.string()).max(5).describe("Empfohlene nächste Schritte, je 1 Satz, priorisiert."),
    });

    try {
      const provider = createLovableAiGatewayProvider(apiKey);
      const result = await generateText({
        model: provider("google/gemini-2.5-flash"),
        experimental_output: Output.object({ schema }),
        system:
          "Du bist GHASI AI, der digitale Geschäftsführer eines Krankentransportunternehmens. " +
          "Analysiere die bereitgestellten Live-Daten und antworte ausschließlich auf Deutsch, präzise und unternehmerisch. " +
          "Du gibst nur Empfehlungen – du führst nichts aus und versendest nichts.",
        prompt: `Erstelle ein kompaktes Executive-Briefing auf Basis dieser aktuellen Unternehmensdaten:\n\n${kontext}`,
      });

      const output = result.experimental_output;
      return {
        lageeinschaetzung: output.lageeinschaetzung,
        chancen: output.chancen ?? [],
        risiken: output.risiken ?? [],
        naechsteSchritte: output.naechsteSchritte ?? [],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      let fehler = "Die KI-Analyse konnte nicht erstellt werden.";
      if (/429|rate limit/i.test(message)) fehler = "KI-Limit erreicht – bitte in Kürze erneut versuchen.";
      else if (/402|credit/i.test(message)) fehler = "KI-Guthaben aufgebraucht – bitte Credits aufladen.";
      return { lageeinschaetzung: "", chancen: [], risiken: [], naechsteSchritte: [], fehler };
    }
  },
);
