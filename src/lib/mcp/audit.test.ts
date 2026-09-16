import { describe, expect, it } from "vitest";
import type { ToolContext } from "@lovable.dev/mcp-js";
import { mitAuditMitSpeicher, type AuditSpeicher } from "./audit";

function kontext(authentifiziert = true): ToolContext {
  return {
    isAuthenticated: () => authentifiziert,
    getUserId: () => (authentifiziert ? "user-1" : undefined),
    getClientId: () => "client-1",
  } as unknown as ToolContext;
}

function speicher(
  anlegen: AuditSpeicher["anlegen"],
  aktualisieren: AuditSpeicher["aktualisieren"] = async () => {},
): AuditSpeicher {
  return { anlegen, aktualisieren };
}

describe("MCP-Audit fail-closed", () => {
  it("fuehrt bindenden Handler nicht aus, wenn die Audit-Reservierung scheitert", async () => {
    let aufrufe = 0;
    const handler = async () => {
      aufrufe += 1;
      return { content: [] };
    };
    const mitAudit = mitAuditMitSpeicher(
      "create_order",
      "ghasi:orders.write",
      handler,
      speicher(async () => {
        throw new Error("DB nicht erreichbar");
      }),
    );

    const ergebnis = await mitAudit({}, kontext());
    expect(ergebnis.isError).toBe(true);
    expect(aufrufe).toBe(0);
  });

  it("reserviert vor bindender Aktion und schliesst denselben Eintrag danach ab", async () => {
    const angelegt: unknown[] = [];
    const aktualisiert: unknown[] = [];
    const mitAudit = mitAuditMitSpeicher(
      "create_invoice",
      "ghasi:invoices.write",
      async () => ({ content: [] }),
      speicher(
        async (e) => {
          angelegt.push(e);
          return "audit-1";
        },
        async (id, e) => {
          aktualisiert.push({ id, e });
        },
      ),
    );

    const ergebnis = await mitAudit({}, kontext());
    expect(ergebnis.isError).toBeUndefined();
    expect(angelegt).toHaveLength(1);
    expect(angelegt[0]).toMatchObject({
      status: "fehler",
      fehlerArt: "AuditVorbehalt",
      auditPhase: "reserviert",
    });
    expect(aktualisiert).toHaveLength(1);
    expect(aktualisiert[0]).toMatchObject({
      id: "audit-1",
      e: { status: "erfolg", auditPhase: "abgeschlossen" },
    });
  });

  it("laesst Lesetools bei Audit-Ausfall weiterlaufen", async () => {
    let aufrufe = 0;
    const mitAudit = mitAuditMitSpeicher(
      "list_orders",
      "ghasi:orders.read",
      async () => {
        aufrufe += 1;
        return { content: [] };
      },
      speicher(async () => {
        throw new Error("DB nicht erreichbar");
      }),
    );

    const ergebnis = await mitAudit({}, kontext());
    expect(ergebnis.isError).toBeUndefined();
    expect(aufrufe).toBe(1);
  });

  it("behaelt die Vorab-Reservierung, wenn der Abschluss des Audits scheitert", async () => {
    let aufrufe = 0;
    let anlagen = 0;
    const mitAudit = mitAuditMitSpeicher(
      "update_order_status",
      "ghasi:orders.status",
      async () => {
        aufrufe += 1;
        return { content: [] };
      },
      speicher(
        async () => {
          anlagen += 1;
          return "audit-2";
        },
        async () => {
          throw new Error("Update fehlgeschlagen");
        },
      ),
    );

    const ergebnis = await mitAudit({}, kontext());
    expect(ergebnis.isError).toBeUndefined();
    expect(ergebnis.completionUncertain).toBe(true);
    expect(ergebnis.retrySafe).toBe(false);
    expect(typeof ergebnis.requestId).toBe("string");
    expect(JSON.stringify(ergebnis.content)).toContain("NICHT automatisch wiederholen");
    expect(aufrufe).toBe(1);
    expect(anlagen).toBe(1);
  });

  it("reserviert nicht fuer unauthentifizierte bindende Aufrufe", async () => {
    let anlagen = 0;
    const mitAudit = mitAuditMitSpeicher(
      "create_order",
      "ghasi:orders.write",
      async () => ({ content: [], isError: true }),
      speicher(async () => {
        anlagen += 1;
        return "audit-3";
      }),
    );

    await mitAudit({}, kontext(false));
    expect(anlagen).toBe(1);
  });
});
