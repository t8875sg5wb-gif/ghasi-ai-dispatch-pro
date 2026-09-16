import { describe, expect, it } from "bun:test";

import {
  darfAuftragStatusAendern,
  darfAuftragVerwalten,
  darfBereich,
  erlaubteBereiche,
  hoechsteRolle,
} from "@/lib/roles";

describe("zentrale Rollenmatrix", () => {
  it("gibt Admin alle Unternehmensbereiche", () => {
    expect(erlaubteBereiche("admin")).toHaveLength(8);
    expect(darfBereich("admin", "finanzen")).toBe(true);
    expect(darfBereich("admin", "patienten")).toBe(true);
  });

  it("trennt Disposition und Finanzen nach Least-Privilege", () => {
    expect(darfBereich("disposition", "patienten")).toBe(true);
    expect(darfBereich("disposition", "finanzen")).toBe(false);
    expect(darfBereich("finanz", "finanzen")).toBe(true);
    expect(darfBereich("finanz", "patienten")).toBe(false);
  });
  it("gibt Fahrern keine unternehmensweiten KI-Bereiche", () => {
    expect(erlaubteBereiche("fahrer")).toEqual([]);
    expect(darfBereich("fahrer", "finanzen")).toBe(false);
    expect(darfBereich(null, "transporte")).toBe(false);
  });

  it("trennt Auftragsverwaltung von Statusänderung", () => {
    expect(darfAuftragVerwalten("admin")).toBe(true);
    expect(darfAuftragVerwalten("disposition")).toBe(true);
    expect(darfAuftragVerwalten("finanz")).toBe(false);
    expect(darfAuftragVerwalten("fahrer")).toBe(false);
    expect(darfAuftragStatusAendern("fahrer")).toBe(true);
    expect(darfAuftragStatusAendern("finanz")).toBe(false);
  });

  it("wählt aus Mehrfachrollen deterministisch die höchste Rolle", () => {
    expect(hoechsteRolle(["fahrer", "finanz", "admin"])).toBe("admin");
    expect(hoechsteRolle(["fahrer", "disposition"])).toBe("disposition");
    expect(hoechsteRolle([])).toBeNull();
  });
});
