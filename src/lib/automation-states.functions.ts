// Server functions for automation on/off persistence (automation_states table).
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AutomationStatus } from "@/lib/automation";

export interface AutomationStateDTO {
  automationId: string;
  status: AutomationStatus;
}

export const listAutomationStates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutomationStateDTO[]> => {
    const { data, error } = await context.supabase
      .from("automation_states")
      .select("automation_id, status");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      automationId: r.automation_id,
      status: r.status as AutomationStatus,
    }));
  });

export const setAutomationState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { automationId: string; status: AutomationStatus }) => {
    if (!data?.automationId) throw new Error("automationId ist erforderlich");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_states")
      .upsert(
        { automation_id: data.automationId, status: data.status } as never,
        { onConflict: "automation_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true } as const;
  });
