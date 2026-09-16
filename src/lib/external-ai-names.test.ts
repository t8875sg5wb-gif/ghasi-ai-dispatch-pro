import { describe, expect, test } from "bun:test";

import { loadAllNamesPaged } from "@/lib/external-ai-names";

describe("externe KI – vollständige Personennamenprüfung", () => {
  test("lädt mehr als 500 Namen vollständig über mehrere Seiten", async () => {
    const rows = Array.from({ length: 1203 }, (_, i) => ({ name: `Synthetik ${i + 1}` }));
    const calls: Array<[number, number]> = [];
    const names = await loadAllNamesPaged(async (from, to) => {
      calls.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    }, 500);

    expect(names).toHaveLength(1203);
    expect(names.at(-1)).toBe("Synthetik 1203");
    expect(calls).toEqual([
      [0, 499],
      [500, 999],
      [1000, 1499],
    ]);
  });

  test("blockiert fail-closed bei einem späteren Abfragefehler", async () => {
    await expect(
      loadAllNamesPaged(async (from) =>
        from === 0
          ? { data: Array.from({ length: 500 }, (_, i) => ({ name: `A ${i}` })), error: null }
          : { data: null, error: { message: "synthetischer DB-Fehler" } },
      ),
    ).rejects.toThrow("synthetischer DB-Fehler");
  });
});
