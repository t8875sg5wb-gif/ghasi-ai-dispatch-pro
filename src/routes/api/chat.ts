import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildKnowledgeSnapshot } from "@/lib/ghasi-knowledge";
import { generateHinweise } from "@/lib/ghasi-hinweise";
import { firecrawlSearch, firecrawlScrape, type WebQuelle } from "@/lib/web-search.server";

const SYSTEM_PROMPT = `Du bist GHASI AI – der digitale Geschäftsführer und persönliche Executive-Assistent
eines Krankentransportunternehmens. Du vereinst zwei Rollen in einer:

1) BUSINESS-MANAGER: Du kennst das Unternehmen (Fahrer, Fahrzeuge, Aufträge, Patienten, Kunden,
   Kliniken, Dialysezentren, Pflegeheime, Kassen, Finanzen, Wartung) und gibst datenbasierte
   Empfehlungen zu Disposition, Touren, Kosten, Gewinn und Risiken.
2) ALLGEMEINER KI-ASSISTENT (wie ChatGPT): Du beantwortest auch ganz normale Alltagsfragen
   natürlich und hilfsbereit – Smalltalk, Erklärungen, Übersetzungen, Texte/E-Mails schreiben,
   Zusammenfassungen, medizinische oder rechtliche Begriffe erklären, Allgemeinwissen.

STIL:
- Du sprichst Deutsch (außer der Nutzer wünscht eine andere Sprache), professionell, warm und präzise.
- Antworten in klarem Markdown (Überschriften, Listen, Fettungen wo sinnvoll).
- Bei Smalltalk locker und menschlich, bei Geschäftsthemen wie ein erfahrener Betriebsleiter.

ECHTZEIT-WISSEN:
- Für aktuelle Informationen (News, Wetter, Verkehr, Sport, Börse, Kryptokurse, Spritpreise,
  Feiertage, Behörden, Gesundheits-/Klinik-Infos, Adressen, allgemeine Fakten von heute) nutzt du
  das Werkzeug "web_suche". Zum Auslesen/Zusammenfassen einer konkreten Seite nutzt du "web_seite_lesen".
- Wenn Informationen aus dem Internet stammen, sage das klar dazu (z.B. „Laut aktuellen Online-Quellen …")
  und nenne die Quellen.
- Ist kein Web-Zugriff verfügbar, sage es ehrlich und antworte mit deinem vorhandenen Wissen.

GEDÄCHTNIS:
- Wichtige Entscheidungen, bestätigte Korrekturen, wiederkehrende Abläufe oder Vorlieben des
  Unternehmers speicherst du mit "gedaechtnis_speichern", damit du langfristig dazulernst.

SICHERHEIT (unbedingt einhalten):
- Du DARFST analysieren, recherchieren, Vorschläge machen sowie E-Mails, WhatsApp-Nachrichten und
  Berichte als ENTWURF formulieren.
- Du DARFST NIEMALS eigenmächtig: E-Mails/Nachrichten senden, Rechnungen freigeben, wichtige Daten
  löschen, Finanzdaten ändern, rechtliche oder personelle Entscheidungen treffen.
- Vor jeder wichtigen oder verbindlichen Aktion holst du ausdrücklich die Bestätigung des
  Unternehmers ein („Soll ich das so vorbereiten?").`;

function textOf(parts: UIMessage["parts"] | undefined): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => p.type === "text")
    .map((p) => ("text" in p ? (p.text as string) : ""))
    .join("");
}

function sammleQuellen(parts: UIMessage["parts"] | undefined): WebQuelle[] {
  if (!Array.isArray(parts)) return [];
  const quellen: WebQuelle[] = [];
  for (const p of parts) {
    if (
      typeof p.type === "string" &&
      p.type.startsWith("tool-web_suche") &&
      "output" in p &&
      p.output &&
      typeof p.output === "object" &&
      "treffer" in (p.output as Record<string, unknown>)
    ) {
      const treffer = (p.output as { treffer?: WebQuelle[] }).treffer ?? [];
      quellen.push(...treffer);
    }
  }
  // doppelte URLs entfernen
  const seen = new Set<string>();
  return quellen.filter((q) => (q.url && !seen.has(q.url) ? (seen.add(q.url), true) : false));
}

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

        const { messages, threadId } = (await request.json()) as {
          messages: UIMessage[];
          threadId?: string;
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Eingehende Nutzer-Nachricht sofort sichern (geht bei Fehlern nicht verloren).
        if (threadId && messages.length > 0) {
          const last = messages[messages.length - 1];
          if (last?.role === "user") {
            const userText = textOf(last.parts);
            await supabaseAdmin.from("chat_messages").insert({
              thread_id: threadId,
              rolle: "user",
              inhalt: userText,
              parts: last.parts as never,
            });
            // Titel aus erster Nutzer-Nachricht ableiten.
            const { data: t } = await supabaseAdmin
              .from("chat_threads")
              .select("titel")
              .eq("id", threadId)
              .single();
            if (t && (t.titel === "Neue Unterhaltung" || !t.titel) && userText.trim()) {
              await supabaseAdmin
                .from("chat_threads")
                .update({ titel: userText.slice(0, 60) })
                .eq("id", threadId);
            }
          }
        }

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

        const heute = new Date().toLocaleDateString("de-DE", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        const kontext = `${SYSTEM_PROMPT}

## Heutiges Datum
${heute}

## Langzeitgedächtnis (gemerkte Entscheidungen & Vorlieben)
${erinnerungen}

## Aktuelle proaktive Hinweise
${hinweise}

${buildKnowledgeSnapshot()}`;

        const provider = createLovableAiGatewayProvider(apiKey);

        const result = streamText({
          model: provider("google/gemini-2.5-flash"),
          system: kontext,
          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(6),
          tools: {
            web_suche: tool({
              description:
                "Durchsucht das Internet in Echtzeit nach aktuellen Informationen (News, Wetter, Verkehr, Sport, Börse, Kryptokurse, Spritpreise, Feiertage, Adressen, allgemeine Fakten). Liefert Treffer mit Titel, URL und Auszug.",
              inputSchema: z.object({
                query: z.string().describe("Die Suchanfrage, möglichst konkret formuliert."),
              }),
              execute: async ({ query }) => firecrawlSearch(query, 5),
            }),
            web_seite_lesen: tool({
              description:
                "Liest den Inhalt einer konkreten Webseite (URL) aus, um sie zusammenzufassen oder Fragen dazu zu beantworten.",
              inputSchema: z.object({
                url: z.string().describe("Die vollständige URL der Seite."),
              }),
              execute: async ({ url }) => firecrawlScrape(url),
            }),
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

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            if (!threadId || !responseMessage) return;
            const quellen = sammleQuellen(responseMessage.parts);
            await supabaseAdmin.from("chat_messages").insert({
              thread_id: threadId,
              rolle: "assistant",
              inhalt: textOf(responseMessage.parts),
              parts: responseMessage.parts as never,
              quellen: (quellen.length > 0 ? quellen : null) as never,
            });
            await supabaseAdmin
              .from("chat_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
          },
        });
      },
    },
  },
});
