import { describe, expect, test } from "bun:test";

import {
  BUSINESS_TIME_ZONE,
  isoToLocalInput,
  localInputToIso,
  normalizeOrderInstant,
} from "@/lib/local-datetime";

describe("Auftragstermine in Betriebszeitzone", () => {
  test("Betriebszeitzone ist Europe/Berlin", () => {
    expect(BUSINESS_TIME_ZONE).toBe("Europe/Berlin");
  });

  test("Sommerzeit: 10:00 Berlin wird 08:00Z", () => {
    expect(localInputToIso("2026-09-16T10:00")).toBe("2026-09-16T08:00:00.000Z");
  });

  test("Winterzeit: 10:00 Berlin wird 09:00Z", () => {
    expect(localInputToIso("2026-01-16T10:00")).toBe("2026-01-16T09:00:00.000Z");
  });

  test("gespeicherter UTC-Zeitpunkt wird als Berliner Wanduhrzeit angezeigt", () => {
    expect(isoToLocalInput("2026-09-16T08:00:00.000Z")).toBe("2026-09-16T10:00");
    expect(isoToLocalInput("2026-01-16T09:00:00.000Z")).toBe("2026-01-16T10:00");
  });

  test("nicht existierende Berliner DST-Wanduhrzeit wird abgelehnt", () => {
    expect(() => localInputToIso("2026-03-29T02:30")).toThrow();
  });

  test("alte lokale Zeit und echter ISO-Zeitpunkt werden kanonisch normalisiert", () => {
    expect(normalizeOrderInstant("2026-09-16T10:00")).toBe("2026-09-16T08:00:00.000Z");
    expect(normalizeOrderInstant("2026-09-16T08:00:00Z")).toBe("2026-09-16T08:00:00.000Z");
  });
});
