// Beweist: Gehaltsfelder von Fahrern sind serverseitig Finanz/Admin vorbehalten,
// alle übrigen Felder bleiben für andere Rollen änderbar.
import { describe, expect, test } from "bun:test";

import { assertLohnFelderBerechtigung, beruehrtLohnFelder } from "@/lib/drivers-security.server";

const UID = "11111111-1111-4111-8111-111111111111";

/** Minimaler Supabase-Stub für `user_roles`-Abfragen. */
function fakeSupabase(rollen: string[]) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: (_spalte: string, erlaubte: string[]) => ({
            data: rollen.filter((r) => erlaubte.includes(r)).map((role) => ({ role })),
          }),
        }),
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("beruehrtLohnFelder", () => {
  test("erkennt monatsbrutto und beschaeftigungsart", () => {
    expect(beruehrtLohnFelder({ monatsbrutto: 1000 })).toBe(true);
    expect(beruehrtLohnFelder({ beschaeftigungsart: "minijob" })).toBe(true);
  });

  test("ignoriert andere Felder", () => {
    expect(beruehrtLohnFelder({ telefon: "0170 1", status: "pause" })).toBe(false);
  });
});

describe("assertLohnFelderBerechtigung", () => {
  test("lehnt Gehaltsänderung ohne Finanz-/Admin-Rolle ab", async () => {
    await expect(
      assertLohnFelderBerechtigung(fakeSupabase(["disposition"]), UID, { monatsbrutto: 2500 }),
    ).rejects.toThrow(/Administration oder Finanzen/);
  });

  test("erlaubt derselben Rolle andere Felder", async () => {
    await expect(
      assertLohnFelderBerechtigung(fakeSupabase(["disposition"]), UID, {
        telefon: "0170 1234567",
        status: "pause",
      }),
    ).resolves.toBeUndefined();
  });

  test("erlaubt Finanz-Rolle die Gehaltsänderung", async () => {
    await expect(
      assertLohnFelderBerechtigung(fakeSupabase(["finanz"]), UID, {
        monatsbrutto: 2500,
        beschaeftigungsart: "svpflichtig",
      }),
    ).resolves.toBeUndefined();
  });
});
