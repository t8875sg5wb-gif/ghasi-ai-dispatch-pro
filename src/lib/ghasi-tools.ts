// GHASI AI – Geschäftsdaten-Werkzeuge für den KI-Assistenten.
// Jede Funktion liefert ECHTE Betriebsdaten (aus den bestehenden Modulen)
// als kompaktes, serialisierbares Ergebnis – inklusive Quellenangabe ("quelle").
// Die Werkzeuge werden je nach Rolle gefiltert (rollenbasierte Berechtigungen).
// Die KI ist ausschließlich lesend/beratend.
import { tool } from "ai";
import { z } from "zod";

import { INITIAL_FAHRER } from "@/lib/fahrer";
import {
  INITIAL_FAHRZEUGE,
  fahrzeugWarnungen,
  reparaturkostenGesamt,
  laeuftAb,
} from "@/lib/fahrzeuge";
import { INITIAL_AUFTRAEGE, STATUS_META, formatTermin } from "@/lib/auftraege";
import { KUNDEN, PATIENTEN } from "@/lib/stammdaten";
import {
  computeKpis,
  computeBusinessHealth,
  computeInsights,
  computePrognosen,
  EUR,
} from "@/lib/ai-brain";
import { searchAll } from "@/lib/ghasi-knowledge";
import { generateHinweise } from "@/lib/ghasi-hinweise";
import { type AppRole, type Bereich, darfBereich } from "@/lib/roles";

const heuteISO = () => new Date().toISOString().slice(0, 10);
const morgenISO = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function enthaelt(haystack: string, needle?: string) {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Baut die rollengefilterten KI-Werkzeuge.
 * Jeder Tool-Output enthält ein Feld "quelle" für Quellenangabe & Audit.
 */
export function buildBusinessTools(role: AppRole | null) {
  const erlaubt = (b: Bereich) => darfBereich(role, b);
  const tools: Record<string, ReturnType<typeof tool>> = {};

  if (erlaubt("transporte")) {
    tools.transporte_abrufen = tool({
      description:
        "Liefert echte Transporte/Aufträge. Filter nach Status (neu, disponiert, unterwegs, abgeschlossen, storniert), Transportart, Fahrer und Zeitraum (heute/morgen/alle). Nutze dies für Fragen zu heutigen/morgigen Fahrten, Verspätungen, Stornierungen, Auslastung der Touren.",
      inputSchema: z.object({
        status: z
          .enum(["neu", "disponiert", "unterwegs", "abgeschlossen", "storniert"])
          .optional(),
        transportart: z
          .enum(["Liegendtransport", "Sitzendtransport", "Rollstuhl", "Dialysefahrt", "Notfall"])
          .optional(),
        fahrer: z.string().optional().describe("Name oder Teil des Fahrernamens"),
        zeitraum: z.enum(["heute", "morgen", "alle"]).optional(),
      }),
      execute: async ({ status, transportart, fahrer, zeitraum }) => {
        const tag = zeitraum === "heute" ? heuteISO() : zeitraum === "morgen" ? morgenISO() : null;
        const treffer = INITIAL_AUFTRAEGE.filter(
          (a) =>
            (!status || a.status === status) &&
            (!transportart || a.transportart === transportart) &&
            enthaelt(a.fahrer ?? "", fahrer) &&
            (!tag || a.termin.slice(0, 10) === tag),
        ).map((a) => ({
          nummer: a.nummer,
          patient: a.patient,
          transportart: a.transportart,
          prioritaet: a.prioritaet,
          status: STATUS_META[a.status].label,
          route: `${a.abholort} → ${a.zielort}`,
          termin: formatTermin(a.termin),
          fahrer: a.fahrer ?? "—",
          fahrzeug: a.fahrzeug ?? "—",
          kostentraeger: a.kostentraeger,
        }));
        return { quelle: "Dispatch", anzahl: treffer.length, transporte: treffer };
      },
    });
  }

  if (erlaubt("fahrer")) {
    tools.fahrer_abrufen = tool({
      description:
        "Liefert echte Fahrerdaten inkl. Status, Überstunden, Pünktlichkeit, Bewertung, km/Umsatz heute. Sortierung 'ueberstunden' beantwortet 'wer hat die höchste Auslastung / Überstunden'. Filter nach Name/Status möglich.",
      inputSchema: z.object({
        name: z.string().optional(),
        status: z
          .enum(["verfuegbar", "unterwegs", "pause", "urlaub", "krank", "feierabend"])
          .optional(),
        sortierung: z.enum(["ueberstunden", "puenktlichkeit", "bewertung", "umsatz"]).optional(),
      }),
      execute: async ({ name, status, sortierung }) => {
        let liste = INITIAL_FAHRER.filter(
          (f) => enthaelt(f.name, name) && (!status || f.status === status),
        );
        if (sortierung === "ueberstunden") liste = [...liste].sort((a, b) => b.ueberstunden - a.ueberstunden);
        if (sortierung === "puenktlichkeit") liste = [...liste].sort((a, b) => b.puenktlichkeit - a.puenktlichkeit);
        if (sortierung === "bewertung") liste = [...liste].sort((a, b) => b.bewertung - a.bewertung);
        if (sortierung === "umsatz") liste = [...liste].sort((a, b) => b.umsatzHeute - a.umsatzHeute);
        return {
          quelle: "Fahrer",
          anzahl: liste.length,
          fahrer: liste.map((f) => ({
            name: f.name,
            nummer: f.nummer,
            status: f.status,
            ueberstunden: f.ueberstunden,
            puenktlichkeit: `${f.puenktlichkeit} %`,
            bewertung: `${f.bewertung}/5`,
            kmHeute: f.kmHeute,
            umsatzHeute: EUR(f.umsatzHeute),
            beschwerden: f.beschwerden,
            lob: f.lob,
            fahrzeug: f.fahrzeug ?? "—",
          })),
        };
      },
    });
  }

  if (erlaubt("fahrzeuge")) {
    tools.fahrzeuge_abrufen = tool({
      description:
        "Liefert echte Fahrzeug-/Flottendaten: Status, Tankstand, Verbrauch, Kilometerstand, TÜV/Wartung/Versicherung. Mit wartungNoetig=true nur Fahrzeuge mit anstehender Wartung/Warnung. Sortierung 'verbrauch' beantwortet 'höchster Kraftstoffverbrauch'.",
      inputSchema: z.object({
        kennzeichen: z.string().optional(),
        status: z.enum(["frei", "unterwegs", "werkstatt", "nicht_verfuegbar"]).optional(),
        wartungNoetig: z.boolean().optional(),
        sortierung: z.enum(["verbrauch", "kilometerstand", "umsatz"]).optional(),
      }),
      execute: async ({ kennzeichen, status, wartungNoetig, sortierung }) => {
        let liste = INITIAL_FAHRZEUGE.filter(
          (v) =>
            enthaelt(`${v.kennzeichen} ${v.marke} ${v.modell}`, kennzeichen) &&
            (!status || v.status === status) &&
            (!wartungNoetig || fahrzeugWarnungen(v).hatWarnung),
        );
        if (sortierung === "verbrauch") liste = [...liste].sort((a, b) => b.verbrauch - a.verbrauch);
        if (sortierung === "kilometerstand") liste = [...liste].sort((a, b) => b.kilometerstand - a.kilometerstand);
        if (sortierung === "umsatz") liste = [...liste].sort((a, b) => b.monatsumsatz - a.monatsumsatz);
        return {
          quelle: "Flotte",
          anzahl: liste.length,
          fahrzeuge: liste.map((v) => {
            const w = fahrzeugWarnungen(v);
            return {
              kennzeichen: v.kennzeichen,
              fahrzeug: `${v.marke} ${v.modell}`,
              typ: v.typ,
              status: v.status,
              tankstand: `${v.tankstand} %`,
              verbrauch: `${v.verbrauch} ${v.kraftstoff === "Elektro" ? "kWh" : "l"}/100km`,
              kilometerstand: v.kilometerstand,
              naechsteWartung: v.naechsteWartung,
              tuevBis: v.tuevBis,
              warnungen: Object.entries(w)
                .filter(([k, val]) => val && k !== "hatWarnung")
                .map(([k]) => k),
              fahrer: v.fahrer ?? "—",
            };
          }),
        };
      },
    });

    tools.wartung_abrufen = tool({
      description:
        "Liefert Wartungs-/Werkstattbedarf: Fahrzeuge mit anstehender Wartung, TÜV, Ölwechsel, Versicherung oder Reifenwechsel in den nächsten Wochen sowie aufgelaufene Reparaturkosten. Beantwortet 'welche Fahrzeuge benötigen nächsten Monat Wartung'.",
      inputSchema: z.object({
        tage: z.number().optional().describe("Vorschauzeitraum in Tagen (Standard 35)"),
      }),
      execute: async ({ tage }) => {
        const horizont = tage ?? 35;
        const liste = INITIAL_FAHRZEUGE.filter((v) => {
          const w = fahrzeugWarnungen(v);
          return (
            v.status === "werkstatt" ||
            w.hatWarnung ||
            laeuftAb(v.naechsteWartung, horizont) ||
            laeuftAb(v.tuevBis, horizont)
          );
        }).map((v) => ({
          kennzeichen: v.kennzeichen,
          status: v.status,
          naechsteWartung: v.naechsteWartung,
          tuevBis: v.tuevBis,
          versicherungBis: v.versicherungBis,
          reifenstatus: v.reifenstatus,
          reparaturkosten: EUR(reparaturkostenGesamt(v)),
        }));
        return { quelle: "Wartung", anzahl: liste.length, fahrzeuge: liste };
      },
    });
  }

  if (erlaubt("patienten")) {
    tools.patienten_abrufen = tool({
      description:
        "Liefert Patientendaten: Mobilität (Gehfähig/Rollstuhl/Liegend), Kostenträger, Hinweise. Mit dialyse=true nur regelmäßige Dialysepatienten. Suche per Name möglich.",
      inputSchema: z.object({
        name: z.string().optional(),
        mobilitaet: z.enum(["Gehfähig", "Rollstuhl", "Liegend"]).optional(),
        dialyse: z.boolean().optional(),
      }),
      execute: async ({ name, mobilitaet, dialyse }) => {
        const liste = PATIENTEN.filter(
          (p) =>
            enthaelt(p.name, name) &&
            (!mobilitaet || p.mobilitaet === mobilitaet) &&
            (!dialyse || /dialyse/i.test(p.hinweis)),
        );
        return {
          quelle: "Patienten",
          anzahl: liste.length,
          patienten: liste.map((p) => ({
            name: p.name,
            mobilitaet: p.mobilitaet,
            kostentraeger: p.kostentraeger,
            hinweis: p.hinweis,
          })),
        };
      },
    });
  }

  if (erlaubt("kunden")) {
    tools.kunden_abrufen = tool({
      description:
        "Liefert Kunden (Krankenkassen, Kliniken, Pflegeeinrichtungen, Privat) inkl. Ansprechpartner und Anzahl offener Rechnungen. Mit nurOffeneRechnungen=true nur Kunden mit offenen Posten.",
      inputSchema: z.object({
        name: z.string().optional(),
        nurOffeneRechnungen: z.boolean().optional(),
      }),
      execute: async ({ name, nurOffeneRechnungen }) => {
        const liste = KUNDEN.filter(
          (k) => enthaelt(k.name, name) && (!nurOffeneRechnungen || k.offeneRechnungen > 0),
        );
        return {
          quelle: "Kunden",
          anzahl: liste.length,
          kunden: liste.map((k) => ({
            name: k.name,
            typ: k.typ,
            ansprechpartner: k.ansprechpartner,
            telefon: k.telefon,
            offeneRechnungen: k.offeneRechnungen,
          })),
        };
      },
    });
  }

  if (erlaubt("finanzen")) {
    tools.finanzen_abrufen = tool({
      description:
        "Liefert echte Finanzkennzahlen: Umsatz & Gewinn (heute/Monat), Marge, gesamte offene Rechnungen und offene Posten je Kunde. Beantwortet Fragen zu Umsatz, Gewinn, Marge, überfälligen/offenen Rechnungen.",
      inputSchema: z.object({}),
      execute: async () => {
        const k = computeKpis();
        return {
          quelle: "Buchhaltung",
          umsatzHeute: EUR(k.umsatzHeute),
          gewinnHeute: EUR(k.gewinnHeute),
          umsatzMonat: EUR(k.umsatzMonat),
          gewinnMonat: EUR(k.gewinnMonat),
          margeProzent: `${k.margeProzent} %`,
          offeneRechnungenGesamt: k.offeneRechnungen,
          offeneRechnungenJeKunde: KUNDEN.filter((kk) => kk.offeneRechnungen > 0).map((kk) => ({
            kunde: kk.name,
            offen: kk.offeneRechnungen,
          })),
        };
      },
    });
  }

  if (erlaubt("kpis")) {
    tools.kennzahlen_abrufen = tool({
      description:
        "Liefert das Executive-Dashboard: Business Health Score (0–100), Flotten-/Fahrerauslastung, laufende/offene Transporte, Pünktlichkeit, KI-Effizienz, kritische Alarme. Für Gesamtlage & Geschäftslage-Fragen.",
      inputSchema: z.object({}),
      execute: async () => {
        const k = computeKpis();
        const h = computeBusinessHealth(k);
        return {
          quelle: "Executive Dashboard",
          businessHealthScore: `${h.score}/100 (${h.stufe})`,
          faktoren: h.faktoren.map((f) => `${f.label}: ${f.wert}/${f.max} (${f.beschreibung})`),
          flottenauslastung: `${k.flottenauslastung} %`,
          fahrerauslastung: `${k.fahrerauslastung} %`,
          laufendeTransporte: k.laufendeTransporte,
          offeneTransporte: k.offeneTransporte,
          puenktlichkeit: `${k.durchschnittPuenktlichkeit} %`,
          aiEffizienz: `${k.aiEffizienz} %`,
          kritischeAlarme: k.kritischeAlarme,
        };
      },
    });

    tools.insights_abrufen = tool({
      description:
        "Liefert KI-Optimierungspotenziale (Insights) mit Begründung, Empfehlung, Wirkung und geschätztem Potenzial. Beantwortet 'wo können wir optimieren / Leerkilometer senken / Touren zusammenlegen / warum sinkt der Gewinn'.",
      inputSchema: z.object({}),
      execute: async () => {
        const list = computeInsights().slice(0, 8);
        return {
          quelle: "AI Brain",
          anzahl: list.length,
          insights: list.map((i) => ({
            titel: i.titel,
            grund: i.erklaerung,
            empfehlung: i.empfehlung,
            wirkung: i.wirkung,
            potenzial: i.potenzial ?? null,
          })),
        };
      },
    });

    tools.prognosen_abrufen = tool({
      description:
        "Liefert Prognosen: erwarteter Wochenumsatz, Engpasstag, Fahrer-Lücke zur Spitze, Wartungen der nächsten 30 Tage sowie Umsatz-Wochenverlauf. Für Vorhersagen/Planungsfragen.",
      inputSchema: z.object({}),
      execute: async () => {
        const p = computePrognosen();
        return {
          quelle: "Prognosen",
          erwarteterWochenumsatz: EUR(p.zusammenfassung.umsatzWocheGesamt),
          engpasstag: p.zusammenfassung.erwarteterEngpassTag,
          fahrerLueckeSpitze: p.zusammenfassung.fahrerLueckeSpitze,
          wartungen30Tage: p.zusammenfassung.wartungenNaechste30Tage,
          umsatzWoche: p.umsatzWoche.map((d) => `${d.label}: ${EUR(d.prognose)}`),
        };
      },
    });

    tools.alarme_abrufen = tool({
      description:
        "Liefert aktuelle Warnungen/Alarme (kritisch/hoch/mittel) aus dem Alert-Center: ablaufende Dokumente, Wartungsfristen, Überstunden, Verspätungen.",
      inputSchema: z.object({}),
      execute: async () => {
        const list = generateHinweise().slice(0, 12);
        return {
          quelle: "Alert-Center",
          anzahl: list.length,
          alarme: list.map((h) => ({ stufe: h.stufe, titel: h.titel, text: h.text })),
        };
      },
    });
  }

  if (erlaubt("suche")) {
    tools.unternehmenssuche = tool({
      description:
        "Durchsucht das gesamte Unternehmen gleichzeitig (Aufträge, Fahrer, Fahrzeuge, Patienten, Kunden, Einrichtungen, Kassen). Nutze dies für 'finde …'-Fragen über mehrere Module hinweg.",
      inputSchema: z.object({
        query: z.string().describe("Suchbegriff, z.B. ein Name, Kennzeichen oder Kunde"),
      }),
      execute: async ({ query }) => {
        const treffer = searchAll(query, 12).map((t) => ({
          bereich: t.bereich,
          titel: t.titel,
          detail: t.untertitel,
        }));
        return { quelle: "Enterprise-Suche", anzahl: treffer.length, treffer };
      },
    });
  }

  // Smart Actions: NUR vorbereiten, niemals ausführen oder versenden.
  const finanzAktionen = role === "admin" || role === "finanz";
  tools.aktion_vorbereiten = tool({
    description:
      "Bereitet eine Aktion als ENTWURF vor (Rechnung, E-Mail, SMS, WhatsApp, Fahrer-Zuweisung, Wartungserinnerung, Dokument, Routenoptimierung). Führt NICHTS aus und versendet NICHTS – der Entwurf muss vom Nutzer ausdrücklich bestätigt werden. Nutze dies, wenn der Nutzer um Vorbereitung/Entwurf bittet.",
    inputSchema: z.object({
      typ: z.enum([
        "rechnung",
        "email",
        "sms",
        "whatsapp",
        "fahrer_zuweisung",
        "wartungserinnerung",
        "dokument",
        "routenoptimierung",
      ]),
      titel: z.string().describe("Kurzer Titel des Entwurfs"),
      empfaenger: z.string().optional().describe("Empfänger/Bezug, falls relevant"),
      betreff: z.string().optional(),
      inhalt: z.string().describe("Der vollständige Entwurfstext bzw. die vorgeschlagene Maßnahme"),
    }),
    execute: async ({ typ, titel, empfaenger, betreff, inhalt }) => {
      if ((typ === "rechnung") && !finanzAktionen) {
        return {
          vorbereitet: false,
          fehler: "Keine Berechtigung für Finanzaktionen in dieser Rolle.",
        };
      }
      return {
        vorbereitet: true,
        typ,
        titel,
        empfaenger: empfaenger ?? null,
        betreff: betreff ?? null,
        inhalt,
        hinweis:
          "Dies ist ein Entwurf. Er wird nicht automatisch ausgeführt oder versendet – bitte ausdrücklich bestätigen.",
      };
    },
  });

  return tools;
}
