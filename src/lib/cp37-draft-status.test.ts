// CP37: `upsertDrafts` legt ausschließlich neue Entwürfe an und darf niemals
// einen vom Client mitgeschickten Status übernehmen.
import { describe, expect, test } from "bun:test";

import { toNewDraftRow } from "@/lib/communication.functions";

describe("upsertDrafts – Statuszwang", () => {
  test("ein vom Client gesendeter Status 'genehmigt' wird auf 'offen' überschrieben", () => {
    const row = toNewDraftRow({
      id: "draft-mahnung-1",
      kategorie: "rechnung",
      kanal: "email",
      titel: "Zahlungserinnerung",
      empfaenger: "kunde@example.com",
      betreff: "Zahlungserinnerung",
      nachricht: "Bitte um Ausgleich.",
      erklaerung: "Rechnung überfällig.",
      grund: "Fälligkeit überschritten",
      quelldaten: {},
      prioritaet: "mittel",
      status: "genehmigt",
    });

    expect(row.status).toBe("offen");
  });

  test("auch 'abgelehnt' wird nicht übernommen", () => {
    const row = toNewDraftRow({ titel: "X", status: "abgelehnt" });
    expect(row.status).toBe("offen");
  });

  test("fehlende optionale Felder werden auf null normalisiert, übrige bleiben erhalten", () => {
    const row = toNewDraftRow({ titel: "X", nachricht: "Y" });
    expect(row.betreff).toBeNull();
    expect(row.bezug).toBeNull();
    expect(row.titel).toBe("X");
    expect(row.nachricht).toBe("Y");
  });
});
