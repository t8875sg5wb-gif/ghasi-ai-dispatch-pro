import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildKnowledgeSnapshot } from "@/lib/ghasi-knowledge";
import { generateHinweise } from "@/lib/ghasi-hinweise";

const SYSTEM_PROMPT = `Du bist GHASI AI – der digitale Geschäftsführer eines Krankentransportunternehmens.
Du sprichst Deutsch, professionell, präzise und vorausschauend, wie ein erfahrener Betriebsleiter.

GRUNDREGELN (unbedingt einhalten):
- Du triffst KEINE finanziellen, rechtlichen oder personellen Entscheidungen selbst.
- Du erstellst ausschließlich Empfehlungen und holst vor jeder wichtigen oder verbindlichen Aktion
  ausdrücklich die Bestätigung des Unternehmers ein ("Soll ich das so vorbereiten?").
- Du nutzt das bereitgestellte Unternehmenswissen für konkrete, datenbasierte Empfehlungen
  (nenne echte Fahrer, Fahrzeuge, Kennzeichen, Auftragsnummern, Kunden).
- Du weist proaktiv auf Risiken hin (Wartung, Überstunden, Fristen, Verspätungen, niedriger Tank).
- Wenn du eine wichtige Entscheidung, Korrektur oder Vorliebe des Unternehmers erfährst, speichere sie
  mit dem Werkzeug "gedaechtnis_speichern", damit du langfristig daraus lernst.
- Fasse dich klar und gib bei Empfehlungen kurze Begründungen.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "LOVABLE_API_KEY fehlt" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const { messages } = (await request.json()) as { messages: UIMessage[] };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: memory } = await supabaseAdmin
          .from("ghasi_memory")
          .select("kategorie, inhalt, wichtigkeit")
          .order("wichtigkeit", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(40);

        const erinnerungen =
          memory && memory.length > 0
            ? memory.map((m) => `- (${m.kategorie}) ${m.inhalt}`).join("\n")
            : "Noch keine gespeicherten Erinnerungen.";

        const hinweise = generateHinweise()
          .slice(0, 12)
          .map((h) => `- [${h.stufe}] ${h.titel}: ${h.text}`)
          .join("\n");

        const kontext = `${SYSTEM_PROMPT}

## Langzeitgedächtnis (gemerkte Entscheidungen & Vorlieben)
${erinnerungen}

## Aktuelle proaktive Hinweise
${hinweise}

${buildKnowledgeSnapshot()}`;

        const provider = createLovableAiGatewayProvider(apiKey);

        const result = streamText({
          model: provider("google/gemini-2.5-flash"),
          system: kontext,
          messages: convertToModelMessages(messages),
          stopWhen: stepCountIs(4),
          tools: {
            gedaechtnis_speichern: tool({
              description:
                "Speichert eine wichtige Entscheidung, Korrektur, Vorliebe oder einen wiederkehrenden Ablauf dauerhaft im Langzeitgedächtnis.",
              inputSchema: z.object({
                kategorie: z
                  .string()
                  .describe("z.B. entscheidung, kunde, fahrer, fahrzeug, ablauf, vorliebe"),
                inhalt: z.string().describe("Was genau gemerkt werden soll, in einem Satz."),
                wichtigkeit: z.number().min(1).max(5).describe("1=gering, 5=sehr wichtig"),
                bezug: z.string().optional().describe("optionaler Bezug, z.B. Fahrername oder Kennzeichen"),
              }),
              execute: async ({ kategorie, inhalt, wichtigkeit, bezug }) => {
                const { error } = await supabaseAdmin.from("ghasi_memory").insert({
                  kategorie,
                  inhalt,
                  wichtigkeit: Math.min(5, Math.max(1, Math.round(wichtigkeit))),
                  quelle: "korrektur",
                  bezug: bezug ?? null,
                });
                if (error) return { gespeichert: false, fehler: error.message };
                return { gespeichert: true };
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse();
      },
    },
  },
});
