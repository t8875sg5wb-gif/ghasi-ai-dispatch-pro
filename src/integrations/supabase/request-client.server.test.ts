import { describe, expect, test } from "bun:test";
import { extractBearerToken } from "@/integrations/supabase/request-client.server";

describe("request-scoped Supabase Auth", () => {
  test("liest Bearer-Token unabhängig von Groß-/Kleinschreibung", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(extractBearerToken("bearer token-123")).toBe("token-123");
  });

  test("lehnt fehlende, leere oder andere Auth-Schemata ab", () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken("Bearer   ")).toBeNull();
    expect(extractBearerToken("Basic abc")).toBeNull();
  });
});
