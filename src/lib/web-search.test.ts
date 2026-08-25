import { describe, expect, it } from "vitest";

import { istWebZugriffKonfiguriert } from "@/lib/web-search.server";

describe("istWebZugriffKonfiguriert", () => {
  it("ist false ohne Key", () => {
    expect(istWebZugriffKonfiguriert(undefined)).toBe(false);
  });
  it("ist false bei leerem/whitespace Key", () => {
    expect(istWebZugriffKonfiguriert("")).toBe(false);
    expect(istWebZugriffKonfiguriert("   ")).toBe(false);
  });
  it("ist true bei gesetztem Key", () => {
    expect(istWebZugriffKonfiguriert("fc-test")).toBe(true);
  });
});
