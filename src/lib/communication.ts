// ============================================================
// GHASI AI — Unified Communication & Notification Layer
// ------------------------------------------------------------
// One shared communication service for EVERY module. Every
// message/notification is linked to its original business object
// (transport, patient, driver, vehicle, invoice, maintenance,
// customer …) so the operator can always jump back to the source.
//
// The AI never sends anything automatically. It only prepares
// professional DRAFTS (KommEntwurf) that wait in the Action Inbox
// for manual Approve / Edit / Reject.
//
// Designed to be modular & scalable: channels and future external
// providers (WhatsApp Business, Twilio SMS, Outlook, Gmail, Teams,
// Slack, Push) are declared here and can be wired to real APIs
// later without touching the UI. Existing modules stay untouched.
// ============================================================
import {
  Truck,
  Users,
  HeartPulse,
  Building2,
  Receipt,
  Wrench,
  Sparkles,
  ShieldAlert,
  Server,
  MessageCircle,
  Smartphone,
  Mail,
  MessageSquare,
  BellRing,
  Send,
  Slack,
  type LucideIcon,
} from "lucide-react";

import { INITIAL_AUFTRAEGE, formatTermin } from "@/lib/auftraege";
import { INITIAL_FAHRER } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";
import { KUNDEN, PATIENTEN } from "@/lib/stammdaten";

/* ------------------------------------------------------------------ *
 * Core domain types
 * ------------------------------------------------------------------ */

export type KommKategorie =
  | "dispatch"
  | "fahrer"
  | "patienten"
  | "kunden"
  | "finanzen"
  | "wartung"
  | "ki"
  | "kritisch"
  | "system";

export type KommKanal = "whatsapp" | "sms" | "email" | "intern" | "fahrer" | "kunde";

export type KommPrioritaet = "kritisch" | "hoch" | "normal" | "niedrig";

export type EntityTyp =
  | "transport"
  | "patient"
  | "fahrer"
  | "fahrzeug"
  | "rechnung"
  | "wartung"
  | "kunde"
  | "system";

/** Link from a message back to its original business object. */
export interface ObjektBezug {
  typ: EntityTyp;
  id: string;
  label: string;
  to: string; // route to the source module
}

export interface KommAnhang {
  id: string;
  name: string;
  art: "pdf" | "bild" | "dokument";
  groesse: string;
}

export interface KommNachricht {
  id: string;
  von: string; // sender
  an: string; // recipient
  kanal: KommKanal;
  zeit: string; // ISO datetime
  text: string;
  eigen?: boolean; // true when sent by us / the operator
  anhaenge?: KommAnhang[];
}

export interface Konversation {
  id: string;
  kategorie: KommKategorie;
  betreff: string;
  partner: string; // external/internal counterpart
  kanal: KommKanal;
  prioritaet: KommPrioritaet;
  gelesen: boolean;
  bezug?: ObjektBezug;
  nachrichten: KommNachricht[];
}

/* ------------------------------------------------------------------ *
 * Display metadata (uses semantic design tokens only)
 * ------------------------------------------------------------------ */

export const KATEGORIE_META: Record<
  KommKategorie,
  { label: string; icon: LucideIcon; badge: string; ring: string }
> = {
  dispatch: {
    label: "Dispatch",
    icon: Truck,
    badge: "border-info/30 bg-info/10 text-info",
    ring: "bg-info/15 text-info",
  },
  fahrer: {
    label: "Fahrer",
    icon: Users,
    badge: "border-accent/30 bg-accent/10 text-accent",
    ring: "bg-accent/15 text-accent",
  },
  patienten: {
    label: "Patienten",
    icon: HeartPulse,
    badge: "border-primary/30 bg-primary/10 text-primary",
    ring: "bg-primary/10 text-primary",
  },
  kunden: {
    label: "Kunden",
    icon: Building2,
    badge: "border-accent/30 bg-accent/10 text-accent",
    ring: "bg-accent/15 text-accent",
  },
  finanzen: {
    label: "Finanzen",
    icon: Receipt,
    badge: "border-warning/30 bg-warning/10 text-warning",
    ring: "bg-warning/20 text-warning",
  },
  wartung: {
    label: "Wartung",
    icon: Wrench,
    badge: "border-warning/30 bg-warning/10 text-warning",
    ring: "bg-warning/20 text-warning",
  },
  ki: {
    label: "KI-Empfehlungen",
    icon: Sparkles,
    badge: "border-primary/30 bg-primary/10 text-primary",
    ring: "bg-gradient-primary text-primary-foreground",
  },
  kritisch: {
    label: "Kritische Alarme",
    icon: ShieldAlert,
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    ring: "bg-destructive/15 text-destructive",
  },
  system: {
    label: "System",
    icon: Server,
    badge: "border-border bg-muted text-muted-foreground",
    ring: "bg-muted text-muted-foreground",
  },
};

/** Ordered category list used for inbox tabs / filters. */
export const KATEGORIE_REIHENFOLGE: KommKategorie[] = [
  "dispatch",
  "fahrer",
  "patienten",
  "kunden",
  "finanzen",
  "wartung",
  "ki",
  "kritisch",
  "system",
];

export const KANAL_META: Record<KommKanal, { label: string; icon: LucideIcon; badge: string }> = {
  whatsapp: {
    label: "WhatsApp",
    icon: MessageCircle,
    badge: "border-success/30 bg-success/10 text-success",
  },
  sms: { label: "SMS", icon: Smartphone, badge: "border-info/30 bg-info/10 text-info" },
  email: { label: "E-Mail", icon: Mail, badge: "border-accent/30 bg-accent/10 text-accent" },
  intern: {
    label: "Interne Nachricht",
    icon: MessageSquare,
    badge: "border-border bg-muted text-muted-foreground",
  },
  fahrer: {
    label: "Fahrer-Benachrichtigung",
    icon: Truck,
    badge: "border-primary/30 bg-primary/10 text-primary",
  },
  kunde: {
    label: "Kunden-Benachrichtigung",
    icon: Building2,
    badge: "border-warning/30 bg-warning/10 text-warning",
  },
};

export const PRIORITAET_META: Record<
  KommPrioritaet,
  { label: string; badge: string; dot: string }
> = {
  kritisch: {
    label: "Kritisch",
    badge: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
  hoch: { label: "Hoch", badge: "border-warning/30 bg-warning/10 text-warning", dot: "bg-warning" },
  normal: { label: "Normal", badge: "border-info/30 bg-info/10 text-info", dot: "bg-info" },
  niedrig: {
    label: "Niedrig",
    badge: "border-border bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
};

const PRIO_RANG: Record<KommPrioritaet, number> = { kritisch: 0, hoch: 1, normal: 2, niedrig: 3 };
export function sortByPrioritaet<T extends { prioritaet: KommPrioritaet }>(list: T[]): T[] {
  return [...list].sort((a, b) => PRIO_RANG[a.prioritaet] - PRIO_RANG[b.prioritaet]);
}

/* ------------------------------------------------------------------ *
 * Future external integrations (declared, ready to wire up)
 * ------------------------------------------------------------------ */

export interface IntegrationInfo {
  id: string;
  label: string;
  icon: LucideIcon;
  beschreibung: string;
  kanal: KommKanal;
  status: "geplant" | "vorbereitet";
}

export const INTEGRATIONEN: IntegrationInfo[] = [
  {
    id: "whatsapp-business",
    label: "WhatsApp Business API",
    icon: MessageCircle,
    beschreibung: "Patienten- & Kundennachrichten direkt über WhatsApp.",
    kanal: "whatsapp",
    status: "geplant",
  },
  {
    id: "twilio-sms",
    label: "Twilio SMS",
    icon: Smartphone,
    beschreibung: "SMS-Benachrichtigungen für Abholzeiten & Verspätungen.",
    kanal: "sms",
    status: "geplant",
  },
  {
    id: "outlook",
    label: "Microsoft Outlook",
    icon: Mail,
    beschreibung: "E-Mail-Postfach für Kunden & Werkstätten.",
    kanal: "email",
    status: "geplant",
  },
  {
    id: "gmail",
    label: "Gmail",
    icon: Mail,
    beschreibung: "Google-Workspace-Postfach anbinden.",
    kanal: "email",
    status: "geplant",
  },
  {
    id: "teams",
    label: "Microsoft Teams",
    icon: MessageSquare,
    beschreibung: "Interne Team-Benachrichtigungen.",
    kanal: "intern",
    status: "geplant",
  },
  {
    id: "slack",
    label: "Slack",
    icon: Slack,
    beschreibung: "Interne Kanäle für Disposition & Leitung.",
    kanal: "intern",
    status: "geplant",
  },
  {
    id: "push",
    label: "Push Notifications",
    icon: BellRing,
    beschreibung: "Mobile Push an die Fahrer-App.",
    kanal: "fahrer",
    status: "geplant",
  },
];

/* ------------------------------------------------------------------ *
 * AI-generated drafts (Action Inbox) — never sent automatically
 * ------------------------------------------------------------------ */

export type EntwurfStatus = "offen" | "genehmigt" | "abgelehnt";

export interface KommEntwurf {
  id: string;
  kategorie: KommKategorie;
  kanal: KommKanal;
  titel: string;
  empfaenger: string;
  betreff?: string;
  nachricht: string; // editable message body
  erklaerung: string; // WHAT the AI prepared & why it helps
  grund: string; // the trigger / reason
  quelldaten: { label: string; wert: string }[]; // source data behind the draft
  bezug?: ObjektBezug;
  prioritaet: KommPrioritaet;
  status: EntwurfStatus;
}

const FIRMA = "Ihr Krankentransport-Team";

function minutenBis(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}
function tageBis(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/**
 * Derives professional draft messages from live business data.
 * Time-relative → call on the client only (avoids SSR mismatch),
 * exactly like the Alert-Center pattern.
 */
export function generateEntwuerfe(): KommEntwurf[] {
  const drafts: KommEntwurf[] = [];

  // 1) Late / imminent patient pickup → SMS draft to the patient
  const baldFaellig = INITIAL_AUFTRAEGE.filter(
    (a) => (a.status === "neu" || a.status === "disponiert") && minutenBis(a.termin) <= 90,
  )
    .sort((a, b) => minutenBis(a.termin) - minutenBis(b.termin))
    .slice(0, 2);
  for (const a of baldFaellig) {
    const min = minutenBis(a.termin);
    const verspaetet = min < 0;
    drafts.push({
      id: `entwurf-sms-${a.id}`,
      kategorie: verspaetet ? "kritisch" : "dispatch",
      kanal: "sms",
      titel: verspaetet ? `Verspätung Abholung ${a.patient}` : `Abhol-Erinnerung ${a.patient}`,
      empfaenger: a.patient,
      nachricht:
        `Guten Tag ${a.patient},\n` +
        (verspaetet
          ? `Ihr Transport zur Fahrt ${a.nummer} verzögert sich leider geringfügig. Unser Fahrer ist auf dem Weg und meldet sich bei Ankunft. Wir bitten um Ihr Verständnis.`
          : `kurze Erinnerung: Ihre Abholung (${a.nummer}) ist für ${formatTermin(a.termin)} ab ${a.abholort} geplant. Bitte halten Sie sich bereit.`) +
        `\n\nFreundliche Grüße\n${FIRMA}`,
      erklaerung:
        "SMS-Entwurf an den Patienten, damit die Abholung transparent bleibt und Rückfragen vermieden werden.",
      grund: verspaetet
        ? `Termin von ${a.nummer} ist überschritten und der Status ist noch „${a.status}".`
        : `Abholtermin von ${a.nummer} ist in ${min} Minuten, Status „${a.status}".`,
      quelldaten: [
        { label: "Auftrag", wert: a.nummer },
        { label: "Patient", wert: a.patient },
        { label: "Termin", wert: formatTermin(a.termin) },
        { label: "Route", wert: `${a.abholort} → ${a.zielort}` },
        { label: "Fahrer", wert: a.fahrer ?? "noch nicht zugewiesen" },
      ],
      bezug: { typ: "transport", id: a.id, label: a.nummer, to: "/auftraege" },
      prioritaet: verspaetet ? "kritisch" : "hoch",
      status: "offen",
    });
  }

  // 2) Vehicle maintenance overdue / due soon → E-Mail draft to the workshop
  const wartungFaellig = INITIAL_FAHRZEUGE.filter(
    (v) => v.status === "werkstatt" || tageBis(v.naechsteWartung) <= 10,
  )
    .sort((a, b) => tageBis(a.naechsteWartung) - tageBis(b.naechsteWartung))
    .slice(0, 2);
  for (const v of wartungFaellig) {
    const tage = tageBis(v.naechsteWartung);
    const ueberfaellig = tage < 0;
    drafts.push({
      id: `entwurf-wartung-${v.id}`,
      kategorie: "wartung",
      kanal: "email",
      titel: `Werkstatt-Termin ${v.kennzeichen}`,
      empfaenger: "Vertragswerkstatt",
      betreff: `Wartungstermin ${v.marke} ${v.modell} (${v.kennzeichen})`,
      nachricht:
        `Sehr geehrtes Werkstatt-Team,\n\n` +
        `für unser Fahrzeug ${v.marke} ${v.modell} (${v.kennzeichen}) ist die Wartung ${ueberfaellig ? `seit ${-tage} Tag(en) überfällig` : `in ${tage} Tag(en) fällig`} (geplant: ${v.naechsteWartung}).\n` +
        `Bitte nennen Sie uns einen kurzfristigen Termin. Aktueller Kilometerstand: ${v.kilometerstand.toLocaleString("de-DE")} km.\n\n` +
        `Vielen Dank und freundliche Grüße\n${FIRMA}`,
      erklaerung:
        "E-Mail-Entwurf an die Werkstatt, um die fällige Wartung rechtzeitig zu terminieren und Ausfälle zu vermeiden.",
      grund: ueberfaellig
        ? `Wartung von ${v.kennzeichen} ist seit ${-tage} Tag(en) überfällig.`
        : `Wartung von ${v.kennzeichen} ist in ${tage} Tag(en) fällig.`,
      quelldaten: [
        { label: "Fahrzeug", wert: `${v.marke} ${v.modell}` },
        { label: "Kennzeichen", wert: v.kennzeichen },
        { label: "Nächste Wartung", wert: v.naechsteWartung },
        { label: "Kilometerstand", wert: `${v.kilometerstand.toLocaleString("de-DE")} km` },
        { label: "Status", wert: v.status },
      ],
      bezug: { typ: "fahrzeug", id: v.id, label: v.kennzeichen, to: "/wartung" },
      prioritaet: ueberfaellig ? "kritisch" : "hoch",
      status: "offen",
    });
  }

  // 3) Overdue invoices → customer reminder draft (E-Mail)
  const offeneKunden = KUNDEN.filter((k) => k.offeneRechnungen > 0)
    .sort((a, b) => b.offeneRechnungen - a.offeneRechnungen)
    .slice(0, 2);
  for (const k of offeneKunden) {
    drafts.push({
      id: `entwurf-rechnung-${k.id}`,
      kategorie: "finanzen",
      kanal: "email",
      titel: `Zahlungserinnerung ${k.name}`,
      empfaenger: k.ansprechpartner ? `${k.ansprechpartner} (${k.name})` : k.name,
      betreff: `Freundliche Zahlungserinnerung – offene Rechnungen`,
      nachricht:
        `Sehr geehrte/r ${k.ansprechpartner || "Damen und Herren"},\n\n` +
        `wir möchten Sie freundlich an ${k.offeneRechnungen} offene Rechnung(en) erinnern. Sollte die Zahlung bereits erfolgt sein, betrachten Sie diese Nachricht bitte als gegenstandslos.\n` +
        `Für Rückfragen stehen wir Ihnen jederzeit gern zur Verfügung.\n\n` +
        `Mit freundlichen Grüßen\n${FIRMA}`,
      erklaerung:
        "Höflicher Mahnungs-Entwurf, der die Liquidität verbessert, ohne die Kundenbeziehung zu belasten.",
      grund: `${k.name} hat ${k.offeneRechnungen} offene Rechnung(en).`,
      quelldaten: [
        { label: "Kunde", wert: k.name },
        { label: "Typ", wert: k.typ },
        { label: "Ansprechpartner", wert: k.ansprechpartner || "—" },
        { label: "Offene Rechnungen", wert: String(k.offeneRechnungen) },
      ],
      bezug: { typ: "kunde", id: k.id, label: k.name, to: "/rechnungen" },
      prioritaet: "normal",
      status: "offen",
    });
  }

  // 4) Driver delay → customer notification draft (running transports)
  const laufend = INITIAL_AUFTRAEGE.filter((a) => a.status === "unterwegs").slice(0, 1);
  for (const a of laufend) {
    const fahrer = INITIAL_FAHRER.find((f) => f.name === a.fahrer);
    drafts.push({
      id: `entwurf-kunde-${a.id}`,
      kategorie: "kunden",
      kanal: "kunde",
      titel: `Statusinfo Kunde – ${a.nummer}`,
      empfaenger: a.kostentraeger,
      betreff: `Aktueller Transportstatus ${a.nummer}`,
      nachricht:
        `Guten Tag,\n\n` +
        `kurze Statusinfo zum Transport ${a.nummer} (${a.patient}): Das Fahrzeug ist aktuell unterwegs Richtung ${a.zielort}.` +
        (fahrer && fahrer.puenktlichkeit < 90
          ? ` Aufgrund der aktuellen Verkehrslage kann es zu einer leichten Verzögerung kommen.`
          : ` Die Ankunft erfolgt voraussichtlich planmäßig.`) +
        `\n\nFreundliche Grüße\n${FIRMA}`,
      erklaerung:
        "Kunden-Benachrichtigung, damit der Auftraggeber proaktiv über den Transportstatus informiert ist.",
      grund: `Transport ${a.nummer} ist unterwegs${fahrer ? ` (Fahrer ${fahrer.name}, Pünktlichkeit ${fahrer.puenktlichkeit} %)` : ""}.`,
      quelldaten: [
        { label: "Auftrag", wert: a.nummer },
        { label: "Auftraggeber", wert: a.kostentraeger },
        { label: "Patient", wert: a.patient },
        { label: "Ziel", wert: a.zielort },
        { label: "Fahrer", wert: a.fahrer ?? "—" },
      ],
      bezug: { typ: "transport", id: a.id, label: a.nummer, to: "/live-gps" },
      prioritaet: "normal",
      status: "offen",
    });
  }

  // 5) Recurring transport changed → patient confirmation draft (WhatsApp)
  const dialyse = PATIENTEN.filter((p) => /dialyse|3×|regelm/i.test(p.hinweis)).slice(0, 1);
  for (const p of dialyse) {
    drafts.push({
      id: `entwurf-serie-${p.id}`,
      kategorie: "patienten",
      kanal: "whatsapp",
      titel: `Serientermin-Bestätigung ${p.name}`,
      empfaenger: p.name,
      nachricht:
        `Guten Tag ${p.name},\n\n` +
        `Ihre wiederkehrende Dialysefahrt wurde angepasst. Bitte bestätigen Sie kurz die neue Abholzeit, damit wir Ihren Serientermin fest einplanen können.\n\n` +
        `Vielen Dank & freundliche Grüße\n${FIRMA}`,
      erklaerung:
        "WhatsApp-Entwurf zur Bestätigung eines geänderten Serientermins – sichert planbaren Umsatz und vermeidet Leerfahrten.",
      grund: `${p.name} ist wiederkehrender Patient (${p.hinweis}).`,
      quelldaten: [
        { label: "Patient", wert: p.name },
        { label: "Mobilität", wert: p.mobilitaet },
        { label: "Kostenträger", wert: p.kostentraeger },
        { label: "Hinweis", wert: p.hinweis },
      ],
      bezug: { typ: "patient", id: p.id, label: p.name, to: "/dialysezentren" },
      prioritaet: "normal",
      status: "offen",
    });
  }

  return sortByPrioritaet(drafts);
}

/* ------------------------------------------------------------------ *
 * Seed inbox (linked to real business objects)
 * ------------------------------------------------------------------ */

export const INITIAL_KONVERSATIONEN: Konversation[] = [
  {
    id: "konv-1",
    kategorie: "dispatch",
    betreff: "Abholung bestätigt – A-2042",
    partner: "Klinikum West (Disposition)",
    kanal: "email",
    prioritaet: "normal",
    gelesen: false,
    bezug: { typ: "transport", id: "a-2", label: "A-2042", to: "/auftraege" },
    nachrichten: [
      {
        id: "n-1-1",
        von: "Klinikum West",
        an: "Disposition",
        kanal: "email",
        zeit: "2026-06-26T09:05",
        text: "Bitte bestätigen Sie die Abholung von Herrn Bauer für 10:15 Uhr. Sauerstoffgerät steht bereit.",
        anhaenge: [{ id: "att-1", name: "Verordnung_Bauer.pdf", art: "pdf", groesse: "82 KB" }],
      },
      {
        id: "n-1-2",
        von: "Disposition",
        an: "Klinikum West",
        kanal: "email",
        zeit: "2026-06-26T09:08",
        text: "Bestätigt. Fahrer M. Keller mit B-KT 142 ist eingeplant.",
        eigen: true,
      },
    ],
  },
  {
    id: "konv-2",
    kategorie: "fahrer",
    betreff: "Schichttausch-Anfrage",
    partner: "S. Yilmaz",
    kanal: "intern",
    prioritaet: "normal",
    gelesen: false,
    bezug: { typ: "fahrer", id: "f-2", label: "S. Yilmaz", to: "/fahrer" },
    nachrichten: [
      {
        id: "n-2-1",
        von: "S. Yilmaz",
        an: "Disposition",
        kanal: "intern",
        zeit: "2026-06-26T08:20",
        text: "Kann ich morgen die Frühschicht mit P. Richter tauschen? Arzttermin am Vormittag.",
      },
    ],
  },
  {
    id: "konv-3",
    kategorie: "patienten",
    betreff: "Rückfrage Abholzeit",
    partner: "Margarete Hoffmann",
    kanal: "whatsapp",
    prioritaet: "hoch",
    gelesen: false,
    bezug: { typ: "patient", id: "p-1", label: "Margarete Hoffmann", to: "/patienten" },
    nachrichten: [
      {
        id: "n-3-1",
        von: "Margarete Hoffmann",
        an: "Service",
        kanal: "whatsapp",
        zeit: "2026-06-26T07:40",
        text: "Guten Morgen, werde ich heute wieder gegen 8:30 Uhr abgeholt?",
      },
    ],
  },
  {
    id: "konv-4",
    kategorie: "finanzen",
    betreff: "Offene Rechnungen Sammelaufstellung",
    partner: "Pflegeheim Sonnenhof",
    kanal: "email",
    prioritaet: "normal",
    gelesen: true,
    bezug: { typ: "kunde", id: "k-4", label: "Pflegeheim Sonnenhof", to: "/rechnungen" },
    nachrichten: [
      {
        id: "n-4-1",
        von: "Pflegeheim Sonnenhof",
        an: "Buchhaltung",
        kanal: "email",
        zeit: "2026-06-25T16:10",
        text: "Bitte senden Sie uns eine Sammelaufstellung der offenen Posten für unsere Buchhaltung.",
      },
    ],
  },
  {
    id: "konv-5",
    kategorie: "wartung",
    betreff: "Kostenvoranschlag Bremsen",
    partner: "Vertragswerkstatt",
    kanal: "email",
    prioritaet: "hoch",
    gelesen: false,
    bezug: { typ: "fahrzeug", id: "v-1", label: "Fahrzeug", to: "/wartung" },
    nachrichten: [
      {
        id: "n-5-1",
        von: "Vertragswerkstatt",
        an: "Fuhrpark",
        kanal: "email",
        zeit: "2026-06-25T11:30",
        text: "Anbei der Kostenvoranschlag für den Bremsenservice. Termin diese Woche möglich.",
        anhaenge: [{ id: "att-2", name: "Kostenvoranschlag.pdf", art: "pdf", groesse: "140 KB" }],
      },
    ],
  },
  {
    id: "konv-6",
    kategorie: "kritisch",
    betreff: "Notfalltransport priorisieren – A-2044",
    partner: "Leitstelle",
    kanal: "intern",
    prioritaet: "kritisch",
    gelesen: false,
    bezug: { typ: "transport", id: "a-5", label: "A-2044", to: "/auftraege" },
    nachrichten: [
      {
        id: "n-6-1",
        von: "Leitstelle",
        an: "Disposition",
        kanal: "intern",
        zeit: "2026-06-26T07:30",
        text: "Notfalltransport A-2044 (Anna Klein) sofort disponieren – höchste Priorität.",
      },
    ],
  },
  {
    id: "konv-7",
    kategorie: "system",
    betreff: "Backup erfolgreich abgeschlossen",
    partner: "GHASI System",
    kanal: "intern",
    prioritaet: "niedrig",
    gelesen: true,
    bezug: { typ: "system", id: "sys-1", label: "System", to: "/einstellungen" },
    nachrichten: [
      {
        id: "n-7-1",
        von: "GHASI System",
        an: "Administration",
        kanal: "intern",
        zeit: "2026-06-26T03:00",
        text: "Das nächtliche Datenbank-Backup wurde erfolgreich erstellt.",
      },
    ],
  },
];

export function letzteNachricht(k: Konversation): KommNachricht | undefined {
  return k.nachrichten[k.nachrichten.length - 1];
}

export function formatZeit(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
