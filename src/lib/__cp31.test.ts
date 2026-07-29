import { describe, expect, test } from "bun:test";
import {
  updateConversationSchema,
  upsertDraftsSchema,
  updateDraftSchema,
} from "./__cp31-schemas";

const CONV_ID = "00000000-0000-4000-8000-000000000001";
const DRAFT_ID = "entwurf-sms-e680815a-d366-48a4-ae86-499dbedfa22e";

const echteNachricht = {
  id: "m1", von: "Anna Klein", an: "Zentrale", kanal: "sms", zeit: "2026-07-01T08:00:00Z",
  text: "Bin unterwegs", eigen: false,
  anhaenge: [{ id: "att-1", name: "Verordnung_Bauer.pdf", art: "pdf", groesse: "82 KB" }],
};
const echterEntwurf = {
  id: DRAFT_ID, kategorie: "dispatch", kanal: "sms", prioritaet: "hoch",
  titel: "Verspätung Abholung", empfaenger: "+49 571 000", betreff: null,
  nachricht: "Text", erklaerung: "KI-Begründung", grund: "Verspätung erkannt",
  quelldaten: [{ label: "Auftrag", wert: "A-2043" }],
  bezug: { typ: "transport", id: "A-2043", label: "A-2043", to: "/auftraege" },
  status: "offen",
};

describe("CP31 Kommunikationsvalidierung", () => {
  test("Bestandsnahe Konversation inkl. Anhang wird akzeptiert", () => {
    expect(updateConversationSchema.safeParse({ id: CONV_ID, values: { gelesen: true, nachrichten: [echteNachricht] } }).success).toBe(true);
  });
  test("Bestandsnaher Entwurf (präfixierte ID) wird akzeptiert", () => {
    expect(upsertDraftsSchema.safeParse({ drafts: [echterEntwurf] }).success).toBe(true);
  });
  test("Anhang ohne groesse wird abgelehnt", () => {
    const n = { ...echteNachricht, anhaenge: [{ id: "a", name: "x.pdf", art: "pdf" }] };
    expect(updateConversationSchema.safeParse({ id: CONV_ID, values: { nachrichten: [n] } }).success).toBe(false);
  });
  test("Unbekanntes Zusatzfeld in values wird abgelehnt", () => {
    expect(updateConversationSchema.safeParse({ id: CONV_ID, values: { gelesen: true, hack: 1 } }).success).toBe(false);
  });
  test("Leeres values-Objekt wird abgelehnt", () => {
    expect(updateConversationSchema.safeParse({ id: CONV_ID, values: {} }).success).toBe(false);
  });
  test("Nicht-UUID Konversations-ID wird abgelehnt", () => {
    expect(updateConversationSchema.safeParse({ id: "konv-1", values: { gelesen: true } }).success).toBe(false);
  });
  test("Ungültige Kategorie wird abgelehnt", () => {
    expect(updateConversationSchema.safeParse({ id: CONV_ID, values: { kategorie: "sonstiges" } }).success).toBe(false);
  });
  test("Ungültiger Kanal im Entwurf wird abgelehnt", () => {
    expect(upsertDraftsSchema.safeParse({ drafts: [{ ...echterEntwurf, kanal: "fax" }] }).success).toBe(false);
  });
  test("Erfundenes Feld im Entwurf wird abgelehnt", () => {
    expect(upsertDraftsSchema.safeParse({ drafts: [{ ...echterEntwurf, gesendetAn: "x" }] }).success).toBe(false);
  });
  test("Ungültiger Entwurfsstatus wird abgelehnt", () => {
    expect(upsertDraftsSchema.safeParse({ drafts: [{ ...echterEntwurf, status: "gesendet" }] }).success).toBe(false);
  });
  test("Fehlendes Pflichtfeld erklaerung wird abgelehnt", () => {
    const { erklaerung: _e, ...ohne } = echterEntwurf;
    expect(upsertDraftsSchema.safeParse({ drafts: [ohne] }).success).toBe(false);
  });
  test("Leerer Titel wird abgelehnt", () => {
    expect(upsertDraftsSchema.safeParse({ drafts: [{ ...echterEntwurf, titel: "   " }] }).success).toBe(false);
  });
  test("Mehr als 200 Entwürfe werden abgelehnt", () => {
    expect(upsertDraftsSchema.safeParse({ drafts: Array.from({ length: 201 }, () => echterEntwurf) }).success).toBe(false);
  });
  test("updateDraft: genehmigt ist gültig, gesendet nicht", () => {
    expect(updateDraftSchema.safeParse({ id: DRAFT_ID, values: { status: "genehmigt" } }).success).toBe(true);
    expect(updateDraftSchema.safeParse({ id: DRAFT_ID, values: { status: "gesendet" } }).success).toBe(false);
  });
  test("updateDraft: fremdes Feld und leeres values werden abgelehnt", () => {
    expect(updateDraftSchema.safeParse({ id: DRAFT_ID, values: { titel: "neu" } }).success).toBe(false);
    expect(updateDraftSchema.safeParse({ id: DRAFT_ID, values: {} }).success).toBe(false);
  });
  test("updateDraft: ID mit Sonderzeichen wird abgelehnt", () => {
    expect(updateDraftSchema.safeParse({ id: "a'; drop--", values: { status: "offen" } }).success).toBe(false);
  });
});
