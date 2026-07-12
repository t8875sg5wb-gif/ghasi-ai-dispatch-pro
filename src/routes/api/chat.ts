import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { buildKnowledgeSnapshot } from "@/lib/ghasi-knowledge";
import { generateHinweise } from "@/lib/ghasi-hinweise";
import { firecrawlSearch, firecrawlScrape, type WebQuelle } from "@/lib/web-search.server";
import { buildBusinessTools } from "@/lib/ghasi-tools";
import { hydrateServerMirrors } from "@/lib/server-mirror.server";
import { ROLE_LABELS, ROLE_BESCHREIBUNG, erlaubteBereiche } from "@/lib/roles";

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

GEDÄCHTNIS (nur mit ausdrücklicher Bestätigung):
- Du speicherst NIEMALS eigenmächtig. Wenn etwas dauerhaft gemerkt werden sollte, machst du mit
  "gedaechtnis_vorschlagen" einen Vorschlag und bittest den Nutzer um ausdrückliche Bestätigung.
  Erst nach seiner Bestätigung wird gespeichert. Sensible Daten (Passwörter, Bankdaten, unnötige
  Gesundheitsdaten) schlägst du nie zur Speicherung vor.

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

/** Sammelt die Geschäfts-Datenquellen (Feld "quelle") aller Tool-Ergebnisse. */
function sammleBusinessQuellen(parts: UIMessage["parts"] | undefined): string[] {
  if (!Array.isArray(parts)) return [];
  const set = new Set<string>();
  for (const p of parts) {
    if (
      typeof p.type === "string" &&
      p.type.startsWith("tool-") &&
      "output" in p &&
      p.output &&
      typeof p.output === "object" &&
      "quelle" in (p.output as Record<string, unknown>)
    ) {
      const q = (p.output as { quelle?: string }).quelle;
      if (q) set.add(q);
    }
  }
  return [...set];
}

/** Sammelt vorbereitete (nicht ausgeführte) Smart Actions aus den Tool-Ergebnissen. */
function sammleVorbereiteteAktionen(parts: UIMessage["parts"] | undefined) {
  if (!Array.isArray(parts)) return [];
  const aktionen: Array<Record<string, unknown>> = [];
  for (const p of parts) {
    if (
      typeof p.type === "string" &&
      p.type.startsWith("tool-aktion_vorbereiten") &&
      "output" in p &&
      p.output &&
      typeof p.output === "object" &&
      (p.output as { vorbereitet?: boolean }).vorbereitet
    ) {
      aktionen.push(p.output as Record<string, unknown>);
    }
  }
  return aktionen;
}

/** Verifiziert das Bearer-Token serverseitig und gibt die Nutzer-ID zurück. */
async function verifiziereToken(
  request: Request,
  admin: typeof import("@/integrations/supabase/client.server").supabaseAdmin,
): Promise<string | null> {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
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

        const startZeit = Date.now();
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { resolveActor, threadGehoert, buildDriverSnapshot, istSensibel } =
          await import("@/lib/ghasi-security.server");

        // SICHERHEIT: Token serverseitig verifizieren. Ohne gültige Session kein Zugriff.
        const userId = await verifiziereToken(request, supabaseAdmin);
        if (!userId) {
          return new Response(JSON.stringify({ error: "Nicht angemeldet" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        // Rolle & Fahrer-Verknüpfung IMMER serverseitig auflösen (nie aus dem Client).
        const { role, driverId } = await resolveActor(userId);

        // SICHERHEIT: Thread-Besitz serverseitig prüfen. Fremde/nicht existierende
        // Threads werden mit derselben generischen Meldung abgewiesen (keine Preisgabe).
        if (threadId) {
          const eigen = await threadGehoert(threadId, userId);
          if (!eigen) {
            return new Response(JSON.stringify({ error: "Kein Zugriff auf diese Unterhaltung." }), {
              status: 403,
              headers: { "content-type": "application/json" },
            });
          }
        }

        // Fahrer arbeiten mit einem request-scoped Eigen-Kontext (keine Mirrors).
        // Alle übrigen Rollen lesen die (unternehmensweit gleichen) Mirror-Daten.
        if (role !== "fahrer") {
          await hydrateServerMirrors();
        }

        // Eingehende Nutzer-Nachricht sofort im (verifiziert eigenen) Thread sichern.
        if (threadId && messages.length > 0) {
          const last = messages[messages.length - 1];
          if (last?.role === "user") {
            const userText = textOf(last.parts);
            await supabaseAdmin.from("chat_messages").insert({
              thread_id: threadId,
              rolle: "user",
              inhalt: userText,
              parts: last.parts as never,
              user_id: userId,
            });
            // Titel aus erster Nutzer-Nachricht ableiten (nur eigener Thread).
            const { data: t } = await supabaseAdmin
              .from("chat_threads")
              .select("titel")
              .eq("id", threadId)
              .eq("user_id", userId)
              .maybeSingle();
            if (t && (t.titel === "Neue Unterhaltung" || !t.titel) && userText.trim()) {
              await supabaseAdmin
                .from("chat_threads")
                .update({ titel: userText.slice(0, 60) })
                .eq("id", threadId)
                .eq("user_id", userId);
            }
          }
        }

        // Gedächtnis: NUR eigene Erinnerungen + admin-freigegebene Unternehmensregeln laden.
        const { data: memoryRoh } = await supabaseAdmin
          .from("ghasi_memory")
          .select("kategorie, inhalt, wichtigkeit, typ, expires_at")
          .or(`user_id.eq.${userId},and(typ.eq.company_rule,genehmigt.eq.true)`)
          .order("wichtigkeit", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(40);

        const jetzt = Date.now();
        const memory = (memoryRoh ?? []).filter(
          (m) => !m.expires_at || new Date(m.expires_at).getTime() > jetzt,
        );

        const erinnerungen =
          memory.length > 0
            ? memory.map((m) => `- (${m.typ}/${m.kategorie}) ${m.inhalt}`).join("\n")
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

        const rollenLabel = role ? ROLE_LABELS[role] : "Unbekannt";
        const bereiche = erlaubteBereiche(role).join(", ") || "keine";
        const rollenKontext = `## Aktuelle Rolle des Nutzers
Rolle: ${rollenLabel} – ${role ? ROLE_BESCHREIBUNG[role] : "Keine Rolle zugewiesen."}
Erlaubte Datenbereiche (nur diese Werkzeuge stehen zur Verfügung): ${bereiche}
Beachte diese Berechtigungen strikt. Stehen für einen Bereich keine Werkzeuge bereit, darf die Rolle ihn nicht einsehen.`;

        const snapshot =
          role === "fahrer"
            ? await buildDriverSnapshot(userId, driverId)
            : buildKnowledgeSnapshot(role);

        const kontext = `${SYSTEM_PROMPT}

## Heutiges Datum
${heute}

${rollenKontext}

## Langzeitgedächtnis (gemerkte Entscheidungen & Vorlieben)
${erinnerungen}

## Aktuelle proaktive Hinweise
${hinweise}

${snapshot}`;

        const provider = createLovableAiGatewayProvider(apiKey);

        const result = streamText({
          model: provider("google/gemini-2.5-flash"),
          system: kontext,
          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(8),
          tools: {
            ...buildBusinessTools(role),
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
            gedaechtnis_vorschlagen: tool({
              description:
                "Schlägt vor, eine Information dauerhaft ins Langzeitgedächtnis zu übernehmen. " +
                "WICHTIG: Dieses Werkzeug speichert NICHTS. Es erstellt nur einen Vorschlag, den der " +
                "Nutzer ausdrücklich bestätigen muss, bevor gespeichert wird. Niemals eigenmächtig speichern.",
              inputSchema: z.object({
                typ: z
                  .enum([
                    "personal",
                    "company_rule",
                    "professional_correction",
                    "temporary",
                    "observation",
                  ])
                  .describe(
                    "personal=persönliche Vorliebe, company_rule=Unternehmensregel (nur Admin), " +
                      "professional_correction=fachliche Korrektur, temporary=temporär, observation=Beobachtung",
                  ),
                kategorie: z
                  .string()
                  .describe("z.B. entscheidung, kunde, fahrer, ablauf, vorliebe"),
                inhalt: z.string().describe("Was genau gemerkt werden soll, in einem Satz."),
                wichtigkeit: z.number().min(1).max(5).describe("1=gering, 5=sehr wichtig"),
                bezug: z.string().optional().describe("optionaler Bezug"),
              }),
              execute: async ({ typ, kategorie, inhalt, wichtigkeit, bezug }) => {
                if (istSensibel(inhalt)) {
                  return {
                    vorgeschlagen: false,
                    grund:
                      "Dieser Inhalt enthält sensible Daten (Zugangs-/Bank-/unnötige Gesundheitsdaten) und darf nicht gespeichert werden.",
                  };
                }
                if (typ === "company_rule" && role !== "admin") {
                  return {
                    vorgeschlagen: false,
                    grund: "Nur Administratoren dürfen Unternehmensregeln anlegen.",
                  };
                }
                return {
                  vorgeschlagen: true,
                  typ,
                  kategorie,
                  inhalt,
                  wichtigkeit: Math.min(5, Math.max(1, Math.round(wichtigkeit))),
                  bezug: bezug ?? null,
                  hinweis:
                    "Vorschlag – bitte ausdrücklich bestätigen, damit ich ihn dauerhaft speichere.",
                };
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            if (!responseMessage) return;
            const webQuellen = sammleQuellen(responseMessage.parts);
            const businessQuellen = sammleBusinessQuellen(responseMessage.parts);
            const vorbereiteteAktionen = sammleVorbereiteteAktionen(responseMessage.parts);
            const werkzeuge = [
              ...new Set(
                (responseMessage.parts ?? [])
                  .filter((p) => typeof p.type === "string" && p.type.startsWith("tool-"))
                  .map((p) => (p.type as string).replace(/^tool-/, "")),
              ),
            ];

            // AUDIT: nur Metadaten – KEINE Roh-Prompts/Antworten (Constitution Art. 15, P6).
            await supabaseAdmin.from("ai_audit_log").insert({
              user_id: userId,
              rolle: role,
              modell: "google/gemini-2.5-flash",
              thread_id: threadId ?? null,
              werkzeuge: werkzeuge.length > 0 ? werkzeuge : null,
              dauer_ms: Date.now() - startZeit,
              erfolg: true,
              quellen: ([...businessQuellen, ...webQuellen.map((q) => q.url)].length > 0
                ? { datenquellen: businessQuellen, web: webQuellen.map((q) => q.url) }
                : null) as never,
              vorbereitete_aktionen: (vorbereiteteAktionen.length > 0
                ? vorbereiteteAktionen.map((a) => ({ typ: a.typ, titel: a.titel }))
                : null) as never,
            });

            if (!threadId) return;
            await supabaseAdmin.from("chat_messages").insert({
              thread_id: threadId,
              rolle: "assistant",
              inhalt: textOf(responseMessage.parts),
              parts: responseMessage.parts as never,
              quellen: (webQuellen.length > 0 ? webQuellen : null) as never,
              user_id: userId,
            });
            await supabaseAdmin
              .from("chat_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId)
              .eq("user_id", userId);
          },
        });
      },
    },
  },
});
