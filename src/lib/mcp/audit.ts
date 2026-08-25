// GHASI AI MCP – Monitoring & Audit-Trail für jede Werkzeug-Ausführung.
//
// Protokolliert ausschließlich Metadaten (Constitution Art. 15):
// Zeitpunkt, Werkzeugname, Scope, Rolle, OAuth-Client, Ergebnisstatus und Dauer.
// NIEMALS Eingabeparameter, Patientendaten, Rückgabewerte oder Tokens.
//
// Ziel-Tabelle ist `ai_audit_log` (dieselbe wie im Chat-Audit); MCP-Einträge
// sind über `modell = "mcp"` erkennbar.
import type { ToolContext } from "@lovable.dev/mcp-js";
import { rolleAusKontext, type McpScope } from "./authz";

/** Ergebnisstatus einer Werkzeug-Ausführung. */
export type ToolStatus = "erfolg" | "fehler" | "abgelehnt";

interface AuditEintrag {
  tool: string;
  scope: McpScope;
  status: ToolStatus;
  dauerMs: number;
  userId: string | undefined;
  rolle: string | null;
  clientId: string | undefined;
  fehlerArt?: string;
}

/** Schreibt einen Audit-Eintrag; Fehler beim Protokollieren dürfen den Aufruf nie kippen. */
async function schreibeAudit(e: AuditEintrag): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_audit_log").insert({
      user_id: e.userId ?? null,
      rolle: e.rolle,
      modell: "mcp",
      thread_id: null,
      werkzeuge: [e.tool],
      dauer_ms: e.dauerMs,
      erfolg: e.status === "erfolg",
      quellen: {
        kanal: "mcp",
        tool: e.tool,
        scope: e.scope,
        status: e.status,
        client_id: e.clientId ?? null,
        ...(e.fehlerArt ? { fehler_art: e.fehlerArt } : {}),
      } as never,
      vorbereitete_aktionen: null,
    });
  } catch {
    // Monitoring darf die Werkzeugausführung nicht beeinträchtigen.
  }
}

type ToolErgebnis = { isError?: boolean } & Record<string, unknown>;

/**
 * Umhüllt einen Werkzeug-Handler mit Monitoring: misst die Dauer, ermittelt den
 * Ergebnisstatus und schreibt einen Audit-Eintrag – auch bei Ausnahmen.
 */
export function mitAudit<I>(
  tool: string,
  scope: McpScope,
  handler: (input: I, ctx: ToolContext) => Promise<ToolErgebnis>,
): (input: I, ctx: ToolContext) => Promise<ToolErgebnis> {
  return async (input, ctx) => {
    const start = Date.now();
    const basis = () => ({
      tool,
      scope,
      dauerMs: Date.now() - start,
      userId: ctx.getUserId(),
      rolle: rolleAusKontext(ctx),
      clientId: ctx.getClientId(),
    });
    try {
      const ergebnis = await handler(input, ctx);
      // Ein isError-Ergebnis ohne aufgelöste Rolle ist eine Autorisierungsabweisung.
      const status: ToolStatus = !ergebnis.isError
        ? "erfolg"
        : rolleAusKontext(ctx) === null
          ? "abgelehnt"
          : "fehler";
      await schreibeAudit({ ...basis(), status });
      return ergebnis;
    } catch (err) {
      await schreibeAudit({
        ...basis(),
        status: "fehler",
        fehlerArt: err instanceof Error ? err.name : "UnbekannterFehler",
      });
      throw err;
    }
  };
}
