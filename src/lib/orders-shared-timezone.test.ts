import { describe, expect, test } from "bun:test";

import { writeToRow } from "@/lib/orders-shared";

describe("writeToRow — zentraler Termin-Schutz", () => {
  test("normalisiert lokale Berliner Wanduhrzeit auf UTC", () => {
    expect(writeToRow({ termin: "2026-09-16T10:00" }).termin).toBe("2026-09-16T08:00:00.000Z");
  });

  test("erhält echten ISO-Zeitpunkt kanonisch", () => {
    expect(writeToRow({ termin: "2026-09-16T08:00:00Z" }).termin).toBe("2026-09-16T08:00:00.000Z");
  });

  test("Teilupdate ohne Termin fügt keinen Termin hinzu", () => {
    expect("termin" in writeToRow({ status: "unterwegs" })).toBe(false);
  });
});
