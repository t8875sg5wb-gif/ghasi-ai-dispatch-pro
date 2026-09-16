import { describe, expect, test } from "bun:test";

import { prepareExternalAiTransmission } from "@/lib/external-ai-transmission";

describe("externe KI – ausgehender Nachrichtenpfad", () => {
  test("sendet an simulierten Provider nur neu aufgebaute Text-Historie", () => {
    const input = [
      {
        id: "u1",
        role: "user",
        parts: [
          { type: "text", text: "Wie ist die allgemeine Geschäftslage?" },
          { type: "file", filename: "patient.pdf", data: "GEHEIM-123" },
        ],
      },
      {
        id: "a1",
        role: "assistant",
        parts: [
          { type: "text", text: "Ich prüfe nur aggregierte Werte." },
          { type: "tool-patienten_abrufen", output: { name: "Synthetik Person", diagnose: "X" } },
        ],
      },
    ];

    const prepared = prepareExternalAiTransmission(input);
    const fakeProviderCapture: unknown[] = [];
    fakeProviderCapture.push(...prepared.messages);

    expect(fakeProviderCapture).toEqual([
      { role: "user", content: "Wie ist die allgemeine Geschäftslage?" },
      { role: "assistant", content: "Ich prüfe nur aggregierte Werte." },
    ]);
    expect(JSON.stringify(fakeProviderCapture)).not.toContain("GEHEIM-123");
    expect(JSON.stringify(fakeProviderCapture)).not.toContain("Synthetik Person");
    expect(prepared.strippedStructuredParts).toBe(2);
  });
  test("prüft auch strukturierte und Tool-Inhalte im Originalbaum", () => {
    const prepared = prepareExternalAiTransmission([
      {
        role: "assistant",
        parts: [
          { type: "tool-intern", output: { patient: "SYNTH-PATIENT-777", note: "sensitiv" } },
        ],
      },
    ]);
    expect(prepared.scanText).toContain("SYNTH-PATIENT-777");
    expect(prepared.messages).toEqual([]);
  });

  test("prüft auch frühere Assistententexte und nicht nur Nutzertexte", () => {
    const prepared = prepareExternalAiTransmission([
      { role: "assistant", parts: [{ type: "text", text: "Telefon 0571 1234567" }] },
      { role: "user", parts: [{ type: "text", text: "Bitte fortfahren" }] },
    ]);
    expect(prepared.scanText).toContain("0571 1234567");
    expect(prepared.messages).toHaveLength(2);
  });
});
