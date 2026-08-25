import { describe, expect, it } from "vitest";

import { istKeyGesetzt } from "@/lib/web-search.server";

describe("istKeyGesetzt", () => {
  it("ist false ohne Key", () => {
    expect(istKeyGesetzt(undefined)).toBe(false);
  });
  it("ist false bei leerem/whitespace Key", () => {
    expect(istKeyGesetzt("")).toBe(false);
    expect(istKeyGesetzt("   ")).toBe(false);
  });
  it("ist true bei gesetztem Key", () => {
    expect(istKeyGesetzt("fc-test")).toBe(true);
  });
});
