// GHASI AI MCP - Audit-Trail fuer jede Werkzeug-Ausfuehrung.
import type { ToolContext } from "@lovable.dev/mcp-js";
import { entscheidungAusKontext, istBindenderMcpScope, type McpScope } from "./authz";

export type ToolStatus = "erfolg" | "fehler" | "abgelehnt";
type AuditPhase = "reserviert" | "abgeschlossen";

interface AuditEintrag {
  tool: string;
  scope: McpScope;
  status: ToolStatus;
  dauerMs: number;
  userId: string | undefined;
  rolle: string | null;
  clientId: string | undefined;
  requestId: string;
  fehlerArt?: string;
  auditPhase?: AuditPhase;
}

export interface AuditSpeicher {
  anlegen(eintrag: AuditEintrag): Promise<string>;
  aktualisieren(id: string, eintrag: AuditEintrag): Promise<void>;
}

function auditPayload(e: AuditEintrag) {
  return {
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
      request_id: e.requestId,
      ...(e.fehlerArt ? { fehler_art: e.fehlerArt } : {}),
      ...(e.auditPhase ? { audit_phase: e.auditPhase } : {}),
    } as never,
    vorbereitete_aktionen: null,
  };
}

const standardAuditSpeicher: AuditSpeicher = {
  async anlegen(eintrag) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_audit_log")
      .insert(auditPayload(eintrag))
      .select("id")
      .single();
    if (error || !data?.id) {
      throw new Error(`MCP-Audit konnte nicht gespeichert werden: ${error?.message ?? "keine ID"}`);
    }
    return data.id;
  },
  async aktualisieren(id, eintrag) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_audit_log")
      .update(auditPayload(eintrag))
      .eq("id", id);
    if (error) throw new Error(`MCP-Audit konnte nicht abgeschlossen werden: ${error.message}`);
  },
};

type ToolErgebnis = { isError?: boolean } & Record<string, unknown>;

async function bestEffortAnlegen(speicher: AuditSpeicher, eintrag: AuditEintrag): Promise<void> {
  try {
    await speicher.anlegen(eintrag);
  } catch {
    // Lesende/abgelehnte Aufrufe duerfen durch reines Monitoring nicht ausfallen.
  }
}

async function bestEffortAktualisieren(
  speicher: AuditSpeicher,
  id: string,
  eintrag: AuditEintrag,
): Promise<boolean> {
  try {
    await speicher.aktualisieren(id, eintrag);
    return true;
  } catch {
    // Der vorher dauerhaft reservierte Datensatz bleibt als Sicherheitsnachweis bestehen.
    return false;
  }
}

/** @internal Testbarer Kern; Produktion verwendet mitAudit(). */
export function mitAuditMitSpeicher<I>(
  tool: string,
  scope: McpScope,
  handler: (input: I, ctx: ToolContext) => Promise<ToolErgebnis>,
  speicher: AuditSpeicher,
): (input: I, ctx: ToolContext) => Promise<ToolErgebnis> {
  return async (input, ctx) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();
    const basis = () => ({
      tool,
      scope,
      dauerMs: Date.now() - start,
      userId: ctx.getUserId(),
      rolle: entscheidungAusKontext(ctx)?.role ?? null,
      clientId: ctx.getClientId(),
      requestId,
    });
    const brauchtReservierung =
      istBindenderMcpScope(scope) && ctx.isAuthenticated() && Boolean(ctx.getUserId());
    let auditId: string | undefined;

    if (brauchtReservierung) {
      try {
        auditId = await speicher.anlegen({
          ...basis(),
          status: "fehler",
          dauerMs: 0,
          fehlerArt: "AuditVorbehalt",
          auditPhase: "reserviert",
        });
      } catch {
        return {
          content: [
            {
              type: "text",
              text: "Sicherheitsprotokoll konnte nicht gespeichert werden. Die Aktion wurde nicht ausgefuehrt.",
            },
          ],
          isError: true,
        };
      }
    }

    try {
      const ergebnis = await handler(input, ctx);
      const status: ToolStatus = !ergebnis.isError
        ? "erfolg"
        : entscheidungAusKontext(ctx)?.abgelehnt
          ? "abgelehnt"
          : "fehler";
      const finalerEintrag: AuditEintrag = {
        ...basis(),
        status,
        auditPhase: auditId ? "abgeschlossen" : undefined,
      };
      if (auditId) {
        const auditAbgeschlossen = await bestEffortAktualisieren(speicher, auditId, finalerEintrag);
        if (!auditAbgeschlossen && !ergebnis.isError) {
          const content = Array.isArray(ergebnis.content) ? ergebnis.content : [];
          return {
            ...ergebnis,
            content: [
              ...content,
              {
                type: "text",
                text:
                  `Die Aktion wurde einmal ausgeführt, aber der Sicherheitsprotokoll-Abschluss ist fehlgeschlagen. ` +
                  `Abschlussstatus unklar; NICHT automatisch wiederholen. Referenz: ${requestId}.`,
              },
            ],
            completionUncertain: true,
            retrySafe: false,
            requestId,
          };
        }
      } else {
        await bestEffortAnlegen(speicher, finalerEintrag);
      }
      return ergebnis;
    } catch (err) {
      const fehlerEintrag: AuditEintrag = {
        ...basis(),
        status: "fehler",
        fehlerArt: err instanceof Error ? err.name : "UnbekannterFehler",
        auditPhase: auditId ? "abgeschlossen" : undefined,
      };
      if (auditId) await bestEffortAktualisieren(speicher, auditId, fehlerEintrag);
      else await bestEffortAnlegen(speicher, fehlerEintrag);
      throw err;
    }
  };
}

export function mitAudit<I>(
  tool: string,
  scope: McpScope,
  handler: (input: I, ctx: ToolContext) => Promise<ToolErgebnis>,
): (input: I, ctx: ToolContext) => Promise<ToolErgebnis> {
  return mitAuditMitSpeicher(tool, scope, handler, standardAuditSpeicher);
}
