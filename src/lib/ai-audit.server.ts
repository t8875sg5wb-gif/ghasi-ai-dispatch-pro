import type { AppRole } from "@/lib/roles";

export interface AiAuditMetadataInput {
  userId: string;
  role: AppRole | null;
  model: string;
  threadId: string | null;
  tools: string[];
  durationMs: number;
  success: boolean;
  sources: { business: string[]; web: string[] };
  preparedActions: Array<{ typ?: unknown; titel?: unknown }>;
}

export type AiAuditWriteStatus = "written" | "unavailable" | "failed";

export function aiAuditServiceConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function writeAiAuditMetadata(
  input: AiAuditMetadataInput,
): Promise<AiAuditWriteStatus> {
  if (!aiAuditServiceConfigured()) {
    console.warn("[ai-audit] Server-Audit nicht konfiguriert; kein Audit-Eintrag geschrieben.");
    return "unavailable";
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const hasSources = input.sources.business.length > 0 || input.sources.web.length > 0;
    const { error } = await supabaseAdmin.from("ai_audit_log").insert({
      user_id: input.userId,
      rolle: input.role,
      modell: input.model.slice(0, 120),
      thread_id: input.threadId,
      werkzeuge: input.tools.length > 0 ? input.tools.slice(0, 32) : null,
      dauer_ms: Math.max(0, Math.round(input.durationMs)),
      erfolg: input.success,
      quellen: hasSources ? input.sources : null,
      vorbereitete_aktionen:
        input.preparedActions.length > 0 ? input.preparedActions.slice(0, 16) : null,
    } as never);
    if (error) {
      console.error("[ai-audit] Metadaten konnten nicht geschrieben werden");
      return "failed";
    }
    return "written";
  } catch (error) {
    console.error("[ai-audit] Server-Audit fehlgeschlagen:", error);
    return "failed";
  }
}
