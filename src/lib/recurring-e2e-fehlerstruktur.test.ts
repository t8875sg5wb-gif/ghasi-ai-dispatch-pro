// End-to-End-Tests der Fehlerstruktur für createRecurring und updateRecurring.
// Sie durchlaufen exakt dieselbe Serverpipeline wie die Serverfunktionen:
// die echten Schemas aus recurring.functions.ts + pruefeDauerauftragRegeln +
// parseOrLog (inkl. Ablehnungsprotokollierung und Marker-Kodierung).
import { describe, expect, it } from "vitest";

import { parseOrLog } from "@/lib/recurring-reject.server";
import {
  dekodiereFeldFehler,
  lesbarerFehlerText,
  pruefeDauerauftragRegeln,
  type DauerauftragRegelInput,
  type FeldFehler,
} from "@/lib/recurring-validation";
import { createRecurringSchema, updateRecurringSchema } from "@/lib/recurring.functions";

type Protokoll = { aktion: string; grund: string; felder: FeldFehler[] };

/** Minimaler Supabase-Stub, der nur die Ablehnungs-Inserts mitschreibt. */
function fakeSupabase(protokoll: Protokoll[]) {
  return {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          if (table === "recurring_rejections") {
            protokoll.push({
              aktion: String(row["aktion"]),
              grund: String(row["grund"]),
              felder: row["felder"] as FeldFehler[],
            });
          }
          return Promise.resolve({ error: null });
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

async function createAufruf(data: unknown) {
  const protokoll: Protokoll[] = [];
  try {
    await parseOrLog(fakeSupabase(protokoll), "create", createRecurringSchema, data, (wert) =>
      pruefeDauerauftragRegeln(wert as DauerauftragRegelInput, true),
    );
    return { fehler: null as Error | null, felder: [] as FeldFehler[], protokoll };
  } catch (e) {
    const fehler = e as Error;
    return { fehler, felder: dekodiereFeldFehler(fehler.message), protokoll };
  }
}

async function updateAufruf(data: unknown) {
  const protokoll: Protokoll[] = [];
  try {
    await parseOrLog(fakeSupabase(protokoll), "update", updateRecurringSchema, data, (wert) =>
      pruefeDauerauftragRegeln(
        (wert as { values: unknown }).values as DauerauftragRegelInput,
        false,
      ),
    );
    return { fehler: null as Error | null, felder: [] as FeldFehler[], protokoll };
  } catch (e) {
    const fehler = e as Error;
    return { fehler, felder: dekodiereFeldFehler(fehler.message), protokoll };
  }
}

const GUELTIG = {
  patient: "Testpatient",
  patientId: "11111111-1111-4111-8111-111111111111",
  pickup: {
    street: "Hauptstr.",
    houseNumber: "1",
    postalCode: "10115",
    city: "Berlin",
  },
  destination: {
    street: "Klinikweg",
    houseNumber: "2",
    postalCode: "10117",
    city: "Berlin",
  },
  terminzeit: "08:30",
  rhythmus: "woechentlich" as const,
  wochentage: [1, 3],
  startDatum: "2026-01-05",
};

describe("E2E-Fehlerstruktur createRecurring", () => {
  it("liefert Pfad, Label und Meldung für ein ungültiges Zeitformat", async () => {
    const { fehler, felder } = await createAufruf({ ...GUELTIG, terminzeit: "8 Uhr" });
    expect(fehler).toBeInstanceOf(Error);
    const treffer = felder.find((f) => f.path === "terminzeit");
    expect(treffer).toBeDefined();
    expect(treffer?.label).toBeTruthy();
    expect(treffer?.message).toBeTruthy();
    // Marker bleibt im technischen message, nicht im lesbaren Text.
    expect(lesbarerFehlerText(fehler!.message)).not.toContain("__GHASI_FELDFEHLER__");
    expect(lesbarerFehlerText(fehler!.message)).toContain("Ungültige Dauerauftragsdaten.");
  });

  it("meldet fehlende Pflichtfelder mit exakten Feldpfaden", async () => {
    const { felder } = await createAufruf({});
    const pfade = felder.map((f) => f.path);
    expect(pfade).toContain("patient");
    expect(pfade).toContain("terminzeit");
    // Pfade sind eindeutig (Deduplizierung, first error wins).
    expect(new Set(pfade).size).toBe(pfade.length);
    for (const f of felder) {
      expect(f.path).not.toMatch(/^values\./);
      expect(typeof f.label).toBe("string");
      expect(typeof f.message).toBe("string");
    }
  });

  it("meldet unbekannte Felder (strict) statt sie stillschweigend zu verwerfen", async () => {
    const { felder } = await createAufruf({ ...GUELTIG, unbekanntesFeld: "x" });
    expect(felder.length).toBeGreaterThan(0);
  });

  it("protokolliert die Ablehnung mit Aktion, Grund und identischer Feldliste", async () => {
    const { felder, protokoll } = await createAufruf({ ...GUELTIG, terminzeit: "" });
    expect(protokoll).toHaveLength(1);
    expect(protokoll[0].aktion).toBe("create");
    expect(protokoll[0].felder).toEqual(felder);
    expect(protokoll[0].grund).toContain(felder[0].message);
  });

  it("greift auch bei fachlichen Querregeln (Wochentage fehlen)", async () => {
    const { felder } = await createAufruf({ ...GUELTIG, wochentage: [] });
    // Querregel ohne eigenen Zod-Pfad -> dokumentierter Fallback-Pfad "formular".
    expect(felder).toHaveLength(1);
    expect(felder[0].path).toBe("formular");
    expect(felder[0].message).toBeTruthy();
  });
});

describe("E2E-Fehlerstruktur updateRecurring", () => {
  it("normalisiert values.-Präfixe im Feldpfad", async () => {
    const { felder } = await updateAufruf({
      id: "22222222-2222-4222-8222-222222222222",
      values: { terminzeit: "morgens" },
    });
    const pfade = felder.map((f) => f.path);
    expect(pfade).toContain("terminzeit");
    expect(pfade.some((p) => p.startsWith("values."))).toBe(false);
  });

  it("meldet eine ungültige ID am Pfad id", async () => {
    const { felder } = await updateAufruf({ id: "keine-uuid", values: { terminzeit: "08:00" } });
    expect(felder.map((f) => f.path)).toContain("id");
  });

  it("meldet leere Änderungsmengen am Pfad values", async () => {
    const { felder } = await updateAufruf({
      id: "22222222-2222-4222-8222-222222222222",
      values: {},
    });
    expect(felder.map((f) => f.path)).toContain("values");
    expect(felder[0].message).toBeTruthy();
  });

  it("protokolliert Update-Ablehnungen mit Aktion update", async () => {
    const { felder, protokoll } = await updateAufruf({
      id: "22222222-2222-4222-8222-222222222222",
      values: { wochentage: [9] },
    });
    expect(protokoll).toHaveLength(1);
    expect(protokoll[0].aktion).toBe("update");
    expect(protokoll[0].felder).toEqual(felder);
    // Array-Elementfehler behalten ihren Index im Feldpfad.
    expect(felder.map((f) => f.path)).toContain("wochentage.0");
  });

  it("lässt gültige Teiländerungen unverändert durch", async () => {
    const { fehler, felder } = await updateAufruf({
      id: "22222222-2222-4222-8222-222222222222",
      values: { terminzeit: "09:15" },
    });
    expect(fehler).toBeNull();
    expect(felder).toEqual([]);
  });
});
