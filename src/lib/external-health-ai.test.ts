import { describe, expect, test } from "bun:test";

import { externalHealthAiAllowed } from "@/lib/external-health-ai";

describe("externe KI für Gesundheitsdokumente", () => {
  test("ist standardmäßig gesperrt", () => {
    expect(externalHealthAiAllowed(undefined, undefined)).toBe(false);
    expect(externalHealthAiAllowed("false", true)).toBe(false);
    expect(externalHealthAiAllowed("true", false)).toBe(false);
  });

  test("braucht Serverfreigabe und ausdrückliche Freigabe pro Vorgang", () => {
    expect(externalHealthAiAllowed("true", true)).toBe(true);
  });
});
