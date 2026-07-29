// Regressionstests für die Fahrer-ID-Kette (bun test).
import { describe, expect, test } from "bun:test";

import { driverFieldsSchema, linkSchema, updateDriverSchema } from "@/lib/drivers.functions";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function fahrerFelder(over: Record<string, unknown> = {}) {
  return {
    name: "Max Mustermann",
    foto: null,
    telefon: "0170 1234567",
    email: "max@example.com",
    adresse: "Hauptstr. 1, 10115 Berlin",
    fuehrerschein: { gueltigBis: "2030-01-01" },
    pSchein: { gueltigBis: "2030-01-01" },
    ersteHilfe: { gueltigBis: "2030-01-01" },
    vertragsart: "Vollzeit",
    arbeitszeiten: "08:00-16:00",
    urlaubstage: 30,
    krankheitstage: 0,
    status: "verfuegbar",
    standort: "Berlin",
    gps: { lat: 52.52, lng: 13.405 },
    fahrzeug: null,
    schicht: "Früh",
    bewertung: 4.5,
    puenktlichkeit: 98,
    beschwerden: 0,
    lob: 2,
    ueberstunden: 0,
    kmHeute: 0,
    umsatzHeute: 0,
    gewinnHeute: 0,
    ...over,
  };
}

describe("linkSchema", () => {
  test("akzeptiert gültiges UUID-Paar", () => {
    expect(linkSchema.safeParse({ driverId: UUID_A, userId: UUID_B }).success).toBe(true);
  });

  test("akzeptiert userId: null (Trennung)", () => {
    expect(linkSchema.safeParse({ driverId: UUID_A, userId: null }).success).toBe(true);
  });

  test("lehnt fehlendes driverId ab", () => {
    expect(linkSchema.safeParse({ userId: UUID_B }).success).toBe(false);
  });

  test("lehnt unbekannten Schlüssel ab (.strict)", () => {
    expect(linkSchema.safeParse({ driverId: UUID_A, userId: UUID_B, role: "admin" }).success).toBe(
      false,
    );
  });
});

describe("driverFieldsSchema", () => {
  test("akzeptiert gültigen Datensatz", () => {
    expect(driverFieldsSchema.safeParse(fahrerFelder()).success).toBe(true);
  });

  test("lehnt ungültigen status ab", () => {
    expect(driverFieldsSchema.safeParse(fahrerFelder({ status: "beschaeftigt" })).success).toBe(
      false,
    );
  });

  test("lehnt deutsches Datumsformat bei pScheinGueltigBis ab", () => {
    expect(
      driverFieldsSchema.safeParse(fahrerFelder({ pScheinGueltigBis: "31.01.2028" })).success,
    ).toBe(false);
  });

  test("akzeptiert ISO-Datum bei pScheinGueltigBis", () => {
    expect(
      driverFieldsSchema.safeParse(fahrerFelder({ pScheinGueltigBis: "2028-01-31" })).success,
    ).toBe(true);
  });

  test("lehnt gps.lat = 95 ab", () => {
    expect(
      driverFieldsSchema.safeParse(fahrerFelder({ gps: { lat: 95, lng: 13.4 } })).success,
    ).toBe(false);
  });

  test("lehnt bewertung = 6 ab", () => {
    expect(driverFieldsSchema.safeParse(fahrerFelder({ bewertung: 6 })).success).toBe(false);
  });

  test("lehnt leeren name ab", () => {
    expect(driverFieldsSchema.safeParse(fahrerFelder({ name: "" })).success).toBe(false);
  });

  test("lehnt leeres telefon ab", () => {
    expect(driverFieldsSchema.safeParse(fahrerFelder({ telefon: "" })).success).toBe(false);
  });

  test("lehnt userId als Schlüssel ab (.strict — keine Kontoverknüpfung über Fahrer-Mutation)", () => {
    expect(driverFieldsSchema.safeParse(fahrerFelder({ userId: UUID_B })).success).toBe(false);
  });
});

describe("updateDriverSchema", () => {
  test("lehnt leeres values ab", () => {
    expect(updateDriverSchema.safeParse({ id: UUID_A, values: {} }).success).toBe(false);
  });

  test("akzeptiert ein einzelnes gültiges Feld", () => {
    expect(updateDriverSchema.safeParse({ id: UUID_A, values: { status: "pause" } }).success).toBe(
      true,
    );
  });
});
