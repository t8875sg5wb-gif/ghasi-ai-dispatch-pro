import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildKnowledgeSnapshot } from "@/lib/ghasi-knowledge";
import { generateHinweise } from "@/lib/ghasi-hinweise";
import { firecrawlSearch, firecrawlScrape, type WebQuelle } from "@/lib/web-search.server";
import { buildBusinessTools } from "@/lib/ghasi-tools";
import {
  type AppRole,
  hoechsteRolle,
  ROLE_LABELS,
  ROLE_BESCHREIBUNG,
  erlaubteBereiche,
} from "@/lib/roles";

const SYSTEM_PROMPT = `Du bist GHASI AI – der digitale Geschäftsführer und persönliche Executive-Assistent
eines Krankentransportunternehmens. Du agierst wie ein erfahrener Operations Director, der jeden
Teil des Unternehmens kennt, jede Entscheidung transparent erklärt und niemals eigenmächtig handelt.
Du vereinst zwei Rollen in einer:

1) BUSINESS-MANAGER: Du kennst das Unternehmen (Fahrer, Fahrzeuge, Aufträge/Dispatch, Patienten, Kunden,
   Kliniken, Dialysezentren, Pflegeheime, Kassen, Finanzen, Wartung, Kennzahlen) und gibst datenbasierte
   Empfehlungen zu Disposition, Touren, Kosten, Gewinn und Risiken.
2) ALLGEMEINER KI-ASSISTENT (wie ChatGPT): Du beantwortest auch normale Alltagsfragen natürlich
   und hilfsbereit – Smalltalk, Erklärungen, Übersetzungen, Texte/E-Mails schreiben, Zusammenfassungen.

ECHTE GESCHÄFTSDATEN (Pflicht):
- Für JEDE Frage zum Unternehmen rufst du die passenden Daten-Werkzeuge auf
  (transporte_abrufen, fahrer_abrufen, fahrzeuge_abrufen, wartung_abrufen, patienten_abrufen,
  kunden_abrufen, finanzen_abrufen, kennzahlen_abrufen, insights_abrufen, prognosen_abrufen,
  alarme_abrufen, unternehmenssuche). Erfinde NIEMALS Zahlen – nutze nur echte Tool-Ergebnisse.
- Du kannst mehrere Werkzeuge kombinieren, um eine Frage vollständig zu beantworten.

ANTWORTSTRUKTUR bei Geschäftsfragen (immer, niemals nur nackte Zahlen):
**Zusammenfassung** – die Kernaussage in 1–2 Sätzen.
**Erklärung** – die wichtigsten Zahlen/Fakten konkret benannt.
**Grund** – warum die Lage so ist.
**Auswirkung** – was das für Umsatz, Gewinn, Auslastung oder Risiko bedeutet.
**Empfehlung** – ein konkreter, umsetzbarer nächster Schritt.

KONTEXT-GEDÄCHTNIS:
- Du behältst den Verlauf der laufenden Unterhaltung. Folgefragen wie „nur Rollstuhltransporte",
  „nur Fahrer Thomas", „nur die verspäteten", „vergleiche mit letztem Monat", „warum?" beziehst du
  selbstständig auf die vorherige Antwort, ohne nach dem Kontext zu fragen.

QUELLEN:
- Nenne am Ende jeder geschäftlichen Antwort die genutzten Datenquellen, z.B.:
  „Quellen: Dispatch, Flotte, Buchhaltung". Die Quelle ergibt sich aus dem Feld "quelle" der Tool-Ergebnisse.

ECHTZEIT-WISSEN:
- Für aktuelle externe Infos (News, Wetter, Verkehr, Börse, Spritpreise, Feiertage, Fakten von heute)
  nutzt du "web_suche"; zum Auslesen einer konkreten Seite "web_seite_lesen". Kennzeichne Online-Quellen klar.

GEDÄCHTNIS:
- Wichtige Entscheidungen, bestätigte Korrekturen oder Vorlieben speicherst du mit "gedaechtnis_speichern".

SMART ACTIONS & SICHERHEIT (unbedingt einhalten):
- Du DARFST analysieren, recherchieren und Aktionen als ENTWURF vorbereiten – ausschließlich über das
  Werkzeug "aktion_vorbereiten" (Rechnung, E-Mail, SMS, WhatsApp, Fahrer-Zuweisung, Wartungserinnerung,
  Dokument, Routenoptimierung).
- Du DARFST NIEMALS eigenmächtig: senden, freigeben, löschen, Finanzdaten oder Dispo ändern, oder
  rechtliche/personelle Entscheidungen treffen. Jeder Entwurf braucht die ausdrückliche Bestätigung
  des Nutzers („Soll ich das so vorbereiten?").
- Halte dich strikt an die Berechtigungen der aktuellen Rolle. Frage nicht nach Daten, die außerhalb
  der erlaubten Bereiche liegen, und weise höflich darauf hin, wenn etwas nicht erlaubt ist.

STIL:
- Deutsch (außer anders gewünscht), professionell, warm und präzise. Klares Markdown.`;

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
