import { describe, expect, test } from "bun:test";
import { activityDedupeKey } from "@/lib/activity-log.server";

describe("activity-log dedupe key", () => {
  test("nimmt nur explizite nicht-leere Schlüssel an", () => {
    expect(
      activityDedupeKey({
        bereich: "A",
        aktion: "B",
        beschreibung: "C",
        metadaten: { dedupeKey: " x " },
      }),
    ).toBe("x");
    expect(activityDedupeKey({ bereich: "A", aktion: "B", beschreibung: "C" })).toBeNull();
    expect(
      activityDedupeKey({
        bereich: "A",
        aktion: "B",
        beschreibung: "C",
        metadaten: { dedupeKey: "   " },
      }),
    ).toBeNull();
  });

  test("begrenzt den Schlüssel auf 160 Zeichen", () => {
    const key = activityDedupeKey({
      bereich: "A",
      aktion: "B",
      beschreibung: "C",
      metadaten: { dedupeKey: "x".repeat(200) },
    });
    expect(key).toHaveLength(160);
  });
});
