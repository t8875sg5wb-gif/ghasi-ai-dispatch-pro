// Regressionstests für die Auftragsvalidierung (bun test).
import { describe, expect, test } from "bun:test";

import { createOrderSchema, orderFieldsSchema, updateOrderSchema } from "@/lib/orders.functions";

const UUID_A = "33333333-3333-3333-3333-333333333333";

describe("orderFieldsSchema — Enums (CP13)", () => {
  test("akzeptiert gültigen status", () => {
    expect(orderFieldsSchema.safeParse({ status: "disponiert" }).success).toBe(true);
  });

  test("lehnt ungültigen status ab", () => {
    expect(orderFieldsSchema.safeParse({ status: "erledigt" }).success).toBe(false);
  });

  test("akzeptiert gültige transportart", () => {
    expect(orderFieldsSchema.safeParse({ transportart: "Rollstuhl" }).success).toBe(true);
  });

  test("lehnt ungültige transportart ab", () => {
    expect(orderFieldsSchema.safeParse({ transportart: "" }).success).toBe(false);
  });

  test("akzeptiert gültige prioritaet", () => {
    expect(orderFieldsSchema.safeParse({ prioritaet: "dringend" }).success).toBe(true);
  });

  test("lehnt ungültige prioritaet ab", () => {
    expect(orderFieldsSchema.safeParse({ prioritaet: "mittel" }).success).toBe(false);
  });
});

describe("orderFieldsSchema — termin", () => {
  test("akzeptiert ISO-Datum/Zeit", () => {
    expect(orderFieldsSchema.safeParse({ termin: "2026-03-10T08:00" }).success).toBe(true);
  });

  test("lehnt deutsches Datumsformat ab", () => {
    expect(orderFieldsSchema.safeParse({ termin: "10.03.2026" }).success).toBe(false);
  });
});

describe("createOrderSchema", () => {
  test("verlangt nicht-leeren patient", () => {
    expect(createOrderSchema.safeParse({ patient: "" }).success).toBe(false);
    expect(createOrderSchema.safeParse({ patient: "Erika Muster" }).success).toBe(true);
  });
});

describe("updateOrderSchema", () => {
  test("lehnt fahrer als Schlüssel ab (.strict — Ursache des CP14-Bugs lag in der UI)", () => {
    expect(
      updateOrderSchema.safeParse({ id: UUID_A, values: { fahrer: "Max Mustermann" } }).success,
    ).toBe(false);
  });

  test("lehnt leeres values ab", () => {
    expect(updateOrderSchema.safeParse({ id: UUID_A, values: {} }).success).toBe(false);
  });

  test("akzeptiert ein einzelnes gültiges Feld", () => {
    expect(
      updateOrderSchema.safeParse({ id: UUID_A, values: { status: "unterwegs" } }).success,
    ).toBe(true);
  });
});
