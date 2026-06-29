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
import {
  INITIAL_AUFTRAEGE,
  STATUS_META,
  formatTermin,
  VERORDNUNG_META,
  MOBILITAET_META,
  effektiveVerordnung,
  effektiveMobilitaet,
  verordnungFehlt,
  empfohlenerFahrzeugtyp,
} from "@/lib/auftraege";
import { KUNDEN, PATIENTEN } from "@/lib/stammdaten";
import {
  DAUERAUFTRAEGE,
  WOCHENTAGE,
  RHYTHMUS_LABEL,
  KATEGORIE_META as DAUER_KATEGORIE_META,
  STATUS_META as DAUER_STATUS_META,
  abgeleiteterStatus,
  transportFaelltAn,
  naechsteTermine,
} from "@/lib/dauerauftraege";
import {
  computeKpis,
  computeBusinessHealth,
  computeInsights,
  computePrognosen,
  EUR,
} from "@/lib/ai-brain";
import { searchAll } from "@/lib/ghasi-knowledge";
import { generateHinweise } from "@/lib/ghasi-hinweise";
import {
  INITIAL_RECHNUNGEN,
  RECHNUNG_STATUS_META,
  computeFinanzKpis,
  detectFinanzAnomalien,
  tageUeberfaellig,
  formatDatum as formatRgDatum,
  EUR as EURf,
} from "@/lib/finance";
import { searchDokumente, KATEGORIE_META, aktuelleVersion } from "@/lib/documents";
import { BERICHT_LISTE, buildBericht, type BerichtTyp } from "@/lib/reporting";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};

  if (erlaubt("transporte")) {
    tools.transporte_abrufen = tool({
      description:
        "Liefert echte Transporte/Aufträge. Filter nach Status (neu, disponiert, unterwegs, abgeschlossen, storniert), Transportart, Fahrer und Zeitraum (heute/morgen/alle). Nutze dies für Fragen zu heutigen/morgigen Fahrten, Verspätungen, Stornierungen, Auslastung der Touren.",
      inputSchema: z.object({
        status: z.enum(["neu", "disponiert", "unterwegs", "abgeschlossen", "storniert"]).optional(),
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
          verordnung: VERORDNUNG_META[effektiveVerordnung(a)].label,
          verordnungFehlt: verordnungFehlt(effektiveVerordnung(a)),
          mobilitaet: MOBILITAET_META[effektiveMobilitaet(a)].label,
          begleitperson: a.begleitperson ? "Ja" : "Nein",
          empfohlenesFahrzeug: empfohlenerFahrzeugtyp(effektiveMobilitaet(a)),
        }));
        return { quelle: "Dispatch", anzahl: treffer.length, transporte: treffer };
      },
    });

    tools.transport_medizin_abrufen = tool({
      description:
        "Beantwortet medizinische/logistische Detailfragen zu einem Transport: Hat der Fahrer die Verordnung? Braucht der Patient Rollstuhl oder Tragestuhl? Ist eine Begleitperson dabei? Welches Fahrzeug passt? Liefert Verordnungsstatus, Mobilität, Begleitperson, Abhol-/Zielanforderungen, Patienten-/medizinische Notizen und empfohlenen Fahrzeugtyp. Suche per Auftragsnummer oder Patientenname.",
      inputSchema: z.object({
        suche: z.string().describe("Auftragsnummer oder Patientenname"),
      }),
      execute: async ({ suche }) => {
        const treffer = INITIAL_AUFTRAEGE.filter(
          (a) => enthaelt(a.nummer, suche) || enthaelt(a.patient, suche),
        ).map((a) => ({
          nummer: a.nummer,
          patient: a.patient,
          status: STATUS_META[a.status].label,
          fahrer: a.fahrer ?? "—",
          fahrzeug: a.fahrzeug ?? "—",
          verordnung: VERORDNUNG_META[effektiveVerordnung(a)].label,
          verordnungVorhanden: !verordnungFehlt(effektiveVerordnung(a)),
          mobilitaet: MOBILITAET_META[effektiveMobilitaet(a)].label,
          begleitperson: a.begleitperson ? "Ja" : "Nein",
          empfohlenesFahrzeug: empfohlenerFahrzeugtyp(effektiveMobilitaet(a)),
          abholanforderung: a.abholanforderung ?? "—",
          zielanforderung: a.zielanforderung ?? "—",
          patientennotiz: a.patientennotiz ?? "—",
          medizinischeNotiz: a.medizinischeNotiz ?? "—",
        }));
        return { quelle: "Dispatch · Medizin", anzahl: treffer.length, transporte: treffer };
      },
    });

    tools.dauerauftraege_abrufen = tool({
      description:
        "Liefert echte Daueraufträge / wiederkehrende Transportserien (Dialyse, Pflegeheim, Klinik). Beantwortet: welche wiederkehrenden Transporte morgen/heute anstehen, welche Dialyse-Serien fehlen, welche Daueraufträge heute Transporte erzeugt haben, welche Patienten wöchentliche Fahrten haben und welche Serie pausiert ist. Filter nach Status (aktiv/pausiert/beendet), Kategorie, Patient und Zeitraum (heute/morgen).",
      inputSchema: z.object({
        status: z.enum(["aktiv", "pausiert", "beendet"]).optional(),
        kategorie: z.enum(["dialyse", "pflegeheim", "krankenhaus", "sonstige"]).optional(),
        patient: z.string().optional().describe("Name oder Teil des Patientennamens"),
        zeitraum: z
          .enum(["heute", "morgen"])
          .optional()
          .describe("Nur Serien, die an diesem Tag einen Transport erzeugen"),
      }),
      execute: async ({ status, kategorie, patient, zeitraum }) => {
        const tag = zeitraum === "heute" ? heuteISO() : zeitraum === "morgen" ? morgenISO() : null;
        const treffer = DAUERAUFTRAEGE.filter((d) => {
          if (status && abgeleiteterStatus(d) !== status) return false;
          if (kategorie && d.kategorie !== kategorie) return false;
          if (!enthaelt(d.patient, patient)) return false;
          if (tag && !transportFaelltAn(d, tag)) return false;
          return true;
        }).map((d) => ({
          kennung: d.kennung,
          patient: d.patient,
          kategorie: DAUER_KATEGORIE_META[d.kategorie].label,
          status: DAUER_STATUS_META[abgeleiteterStatus(d)].label,
          rhythmus: RHYTHMUS_LABEL[d.rhythmus],
          wochentage:
            d.rhythmus === "woechentlich"
              ? d.wochentage
                  .slice()
                  .sort()
                  .map((w) => WOCHENTAGE.find((x) => x.wert === w)?.kurz)
                  .join(", ")
              : "täglich",
          uhrzeit: d.terminzeit,
          rueckfahrt: d.rueckfahrt ? "Ja" : "Nein",
          route: `${d.abholort} → ${d.zielort}`,
          mobilitaet: MOBILITAET_META[d.mobilitaet].label,
          begleitperson: d.begleitperson ? "Ja" : "Nein",
          kostentraeger: d.kostentraeger,
          krankenkasse: d.krankenkasse,
          naechsterTermin: naechsteTermine(d, 1)[0] ?? "—",
          heuteErzeugt: tag ? d.generierteTermine.includes(tag) : undefined,
          erzeugteTermineGesamt: d.generierteTermine.length,
        }));
        return { quelle: "Daueraufträge", anzahl: treffer.length, serien: treffer };
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
        if (sortierung === "ueberstunden")
          liste = [...liste].sort((a, b) => b.ueberstunden - a.ueberstunden);
        if (sortierung === "puenktlichkeit")
          liste = [...liste].sort((a, b) => b.puenktlichkeit - a.puenktlichkeit);
        if (sortierung === "bewertung")
          liste = [...liste].sort((a, b) => b.bewertung - a.bewertung);
        if (sortierung === "umsatz")
          liste = [...liste].sort((a, b) => b.umsatzHeute - a.umsatzHeute);
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
        if (sortierung === "verbrauch")
          liste = [...liste].sort((a, b) => b.verbrauch - a.verbrauch);
        if (sortierung === "kilometerstand")
          liste = [...liste].sort((a, b) => b.kilometerstand - a.kilometerstand);
        if (sortierung === "umsatz")
          liste = [...liste].sort((a, b) => b.monatsumsatz - a.monatsumsatz);
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

    tools.live_gps_abrufen = tool({
      description:
        "Liefert ECHTE Live-GPS- & Transport-Execution-Daten: aktuelle Fahrzeugposition, Status (frei/fährt/wartet/Notfall/offline), Geschwindigkeit, Tankstand, letzte Aktualisierung, zugewiesener Transport mit Phase/ETA, Mobilität, Verordnungsstatus, Begleitperson, Fahrzeug-Eignung sowie aktive Alerts. Beantwortet Fragen wie 'Wo ist Fahrzeug B-KT 142?', 'Hat der Fahrer die Verordnung erhalten?', 'Ist der Patient Rollstuhl oder liegend?', 'Welche Transporte sind verspätet?', 'Welche Verordnungen fehlen?', 'Welches Fahrzeug ist offline?'.",
      inputSchema: z.object({
        kennzeichen: z
          .string()
          .optional()
          .describe("Kennzeichen, Fahrername oder Fahrzeug-Nummer (Teiltreffer)"),
        nurAlerts: z.boolean().optional().describe("nur Fahrzeuge mit aktiven Alerts"),
        nurVerspaetet: z.boolean().optional().describe("nur verspätete Transporte"),
      }),
      execute: async ({ kennzeichen, nurAlerts, nurVerspaetet }) => {
        const { buildFleet, FLEET_FARBEN } = await import("@/lib/fleet-live");
        const { LIVE_STATUS_META } = await import("@/lib/dispatch");
        const fleet = buildFleet().filter(
          (v) =>
            enthaelt(`${v.kennzeichen} ${v.fahrer ?? ""} ${v.nummer}`, kennzeichen) &&
            (!nurAlerts || v.alerts.length > 0) &&
            (!nurVerspaetet || (v.assignment?.transport.verspaetungMin ?? 0) >= 10),
        );
        return {
          quelle: "Live-GPS · Transport-Execution",
          anzahl: fleet.length,
          fahrzeuge: fleet.map((v) => ({
            kennzeichen: v.kennzeichen,
            typ: v.typ,
            fahrer: v.fahrer ?? "—",
            status: FLEET_FARBEN[v.farbe].label,
            standort: v.standort,
            position: `${v.gps.lat}, ${v.gps.lng}`,
            geschwindigkeit: `${v.geschwindigkeit} km/h`,
            tankstand: `${v.tankstand} %`,
            letzteAktualisierung: v.letzteAktualisierung,
            transport: v.assignment
              ? {
                  nummer: v.assignment.transport.nummer,
                  patient: v.assignment.transport.patient,
                  phase: LIVE_STATUS_META[v.assignment.liveStatus].label,
                  von: v.assignment.transport.abholort,
                  nach: v.assignment.transport.zielort,
                  eta: v.assignment.eta,
                  mobilitaet: MOBILITAET_META[v.assignment.mobilitaet].label,
                  verordnung: v.assignment.verordnungFehlt ? "FEHLT" : "vorhanden",
                  begleitperson: v.assignment.begleitperson ? "Ja" : "Nein",
                  fahrzeugPasst: v.assignment.fahrzeugPasst ? "Ja" : "NEIN",
                }
              : null,
            alerts: v.alerts.map((a) => `[${a.schwere}] ${a.titel}: ${a.details}`),
          })),
        };
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

    tools.rechnungen_abrufen = tool({
      description:
        "Liefert echte Rechnungen & Gutschriften mit Status (offen, bezahlt, teilbezahlt, überfällig, storniert), Betrag, Fälligkeit, Abrechnungsart und Bezug zum Transport. Mit nurUeberfaellig=true nur überfällige. Beantwortet 'welche Rechnungen sind überfällig/offen'.",
      inputSchema: z.object({
        status: z
          .enum(["entwurf", "offen", "bezahlt", "teilbezahlt", "ueberfaellig", "storniert"])
          .optional(),
        kunde: z.string().optional(),
        nurUeberfaellig: z.boolean().optional(),
      }),
      execute: async ({ status, kunde, nurUeberfaellig }) => {
        const liste = INITIAL_RECHNUNGEN.filter(
          (r) =>
            (!status || r.status === status) &&
            enthaelt(r.kunde, kunde) &&
            (!nurUeberfaellig || tageUeberfaellig(r) > 0),
        ).map((r) => ({
          nummer: r.nummer,
          kunde: r.kunde,
          abrechnungsart: r.abrechnungsart,
          betrag: EURf(r.betrag),
          status: RECHNUNG_STATUS_META[r.status].label,
          faelligkeit: formatRgDatum(r.faelligkeit),
          tageUeberfaellig: tageUeberfaellig(r),
          bezugAuftrag: r.bezugAuftrag ?? "—",
        }));
        const k = computeFinanzKpis();
        return {
          quelle: "Buchhaltung · Rechnungen",
          anzahl: liste.length,
          summen: {
            offenePosten: EURf(k.offenePosten),
            ueberfaellig: EURf(k.ueberfaelligeSumme),
            bezahlt: EURf(k.bezahltSumme),
          },
          rechnungen: liste,
        };
      },
    });

    tools.finanz_anomalien_abrufen = tool({
      description:
        "Liefert die KI-Rechnungsprüfung: erkannte überfällige, fehlende, doppelte und unbezahlte Rechnungen sowie Inkonsistenzen – jeweils mit Grund, Quelle, Wirkung, Konfidenz und Empfehlung. GHASI AI versendet nichts automatisch.",
      inputSchema: z.object({}),
      execute: async () => {
        const list = detectFinanzAnomalien();
        return {
          quelle: "AI Brain · Finanzprüfung",
          anzahl: list.length,
          anomalien: list.map((a) => ({
            typ: a.typ,
            titel: a.titel,
            grund: a.grund,
            quelle: a.quelle,
            wirkung: a.wirkung,
            konfidenz: `${a.konfidenz} %`,
            empfehlung: a.empfehlung,
          })),
        };
      },
    });

    tools.kostenaufstellung_abrufen = tool({
      description:
        "Liefert die Kostenaufstellung des Monats: Fahrzeug-, Kraftstoff-, Wartungs-, Fahrer- und Leasingkosten sowie Gesamtkosten. Beantwortet 'wo entstehen die Kosten / wo können Kosten gesenkt werden'.",
      inputSchema: z.object({}),
      execute: async () => {
        const k = computeFinanzKpis();
        return {
          quelle: "Buchhaltung · Kostenstellen",
          fahrzeugkosten: EURf(k.kosten.fahrzeugkosten),
          kraftstoffkosten: EURf(k.kosten.kraftstoffkosten),
          wartungskosten: EURf(k.kosten.wartungskosten),
          fahrerkosten: EURf(k.kosten.fahrerkosten),
          leasingkosten: EURf(k.kosten.leasingkosten),
          gesamt: EURf(k.kosten.gesamt),
        };
      },
    });

    tools.dokumente_abrufen = tool({
      description:
        "Durchsucht das Dokumentencenter (Rezepte, Aufträge, Verträge, Rechnungen, Fahrer-/Fahrzeugdokumente, Versicherungen, Wartungsbelege) inkl. OCR-Text, Tags und Verknüpfungen. Beantwortet 'finde Dokument/Verordnung/Vertrag zu …'.",
      inputSchema: z.object({
        query: z.string().optional().describe("Suchbegriff (Name, Tag, OCR-Inhalt, Bezug)"),
      }),
      execute: async ({ query }) => {
        const liste = searchDokumente(query ?? "")
          .slice(0, 12)
          .map((d) => ({
            name: d.name,
            kategorie: KATEGORIE_META[d.kategorie].label,
            ordner: d.ordner,
            version: aktuelleVersion(d).version,
            verknuepftMit: d.bezug?.label ?? "—",
          }));
        return { quelle: "Dokumentencenter", anzahl: liste.length, dokumente: liste };
      },
    });

    tools.bericht_erstellen = tool({
      description:
        "Erstellt einen Enterprise-Report aus Live-Daten (Umsatz, Gewinn, Fahrzeugauslastung, Fahrerleistung, Kunden, Patienten, Transporte, Kraftstoff, Wartung). Liefert Spalten und Zeilen für eine kompakte Zusammenfassung.",
      inputSchema: z.object({
        typ: z.enum([
          "umsatz",
          "gewinn",
          "fahrzeugauslastung",
          "fahrerleistung",
          "kunden",
          "patienten",
          "transporte",
          "kraftstoff",
          "wartung",
        ]),
      }),
      execute: async ({ typ }) => {
        const b = buildBericht(typ as BerichtTyp);
        return {
          quelle: "Reporting-Engine",
          titel: b.titel,
          spalten: b.spalten,
          zeilen: b.zeilen.slice(0, 20),
          summe: b.summe ?? null,
          verfuegbareBerichte: BERICHT_LISTE.map((r) => r.typ),
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
      if (typ === "rechnung" && !finanzAktionen) {
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
