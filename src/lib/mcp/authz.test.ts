import { describe, expect, it } from "vitest";
import {
  ALLE_SCOPES,
  BINDENDE_MCP_SCOPES,
  ROLLEN_SCOPES,
  istBindenderMcpScope,
  rolleHatScope,
  tokenHatScope,
} from "./authz";

describe("MCP-Autorisierung", () => {
  it("Admin besitzt alle Scopes", () => {
    for (const s of ALLE_SCOPES) expect(rolleHatScope("admin", s)).toBe(true);
  });

  it("Disposition hat keine Rechnungs-Scopes", () => {
    expect(rolleHatScope("disposition", "ghasi:invoices.read")).toBe(false);
    expect(rolleHatScope("disposition", "ghasi:invoices.write")).toBe(false);
    expect(rolleHatScope("disposition", "ghasi:orders.write")).toBe(true);
  });

  it("Finanz darf keine Aufträge oder Fahrer schreiben/lesen", () => {
    expect(rolleHatScope("finanz", "ghasi:orders.write")).toBe(false);
    expect(rolleHatScope("finanz", "ghasi:drivers.read")).toBe(false);
    expect(rolleHatScope("finanz", "ghasi:invoices.write")).toBe(true);
  });

  it("Fahrer darf nur eigene Touren lesen und Status ändern", () => {
    expect(ROLLEN_SCOPES.fahrer).toEqual([
      "ghasi:orders.read",
      "ghasi:orders.status",
      "ghasi:vehicles.read",
    ]);
    expect(rolleHatScope("fahrer", "ghasi:orders.write")).toBe(false);
    expect(rolleHatScope("fahrer", "ghasi:invoices.read")).toBe(false);
  });

  it("ohne Rolle gibt es keinen Zugriff", () => {
    expect(rolleHatScope(null, "ghasi:orders.read")).toBe(false);
  });

  it("Token ohne ghasi-Scopes wird nicht durch die Scope-Schranke blockiert", () => {
    expect(tokenHatScope(undefined, "ghasi:orders.read")).toBe(true);
    expect(tokenHatScope(["openid", "email"], "ghasi:orders.read")).toBe(true);
  });

  it("Token mit ghasi-Scopes verengt auf die erteilten Scopes", () => {
    expect(tokenHatScope(["ghasi:orders.read"], "ghasi:orders.read")).toBe(true);
    expect(tokenHatScope(["ghasi:orders.read"], "ghasi:invoices.write")).toBe(false);
  });

  it("alle bindenden Schreib- und Status-Scopes sind fail-closed markiert", () => {
    const mutierendeScopes = ALLE_SCOPES.filter(
      (scope) => scope.endsWith(".write") || scope.endsWith(".status"),
    );
    expect(BINDENDE_MCP_SCOPES).toEqual(mutierendeScopes);
    for (const scope of mutierendeScopes) expect(istBindenderMcpScope(scope)).toBe(true);
    expect(istBindenderMcpScope("ghasi:orders.read")).toBe(false);
    expect(istBindenderMcpScope("ghasi:invoices.read")).toBe(false);
  });
});
