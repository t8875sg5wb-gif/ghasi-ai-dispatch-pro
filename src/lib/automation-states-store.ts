// Browser store for automation on/off persistence.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  listAutomationStates,
  setAutomationState,
} from "@/lib/automation-states.functions";
import type { AutomationStatus } from "@/lib/automation";

export const AUTOMATION_STATES_QUERY_KEY = ["automation_states"] as const;

export function useAutomationStates() {
  const fn = useServerFn(listAutomationStates);
  return useQuery({
    queryKey: AUTOMATION_STATES_QUERY_KEY,
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}

export function useSetAutomationState() {
  const qc = useQueryClient();
  const fn = useServerFn(setAutomationState);
  return useMutation({
    mutationFn: (input: { automationId: string; status: AutomationStatus }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: AUTOMATION_STATES_QUERY_KEY }),
  });
}
