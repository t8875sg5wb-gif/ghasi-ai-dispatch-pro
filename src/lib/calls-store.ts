// Browser store for persisted calls (Anrufprotokoll). Mirrors into the legacy
// `INITIAL_ANRUFE` array so modules reading it synchronously reflect state.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { INITIAL_ANRUFE, type Anruf } from "@/lib/telefon";
import {
  listCalls,
  createCall,
  updateCall,
  deleteCall,
  seedCalls,
} from "@/lib/calls.functions";
import type { CallWrite } from "@/lib/calls-shared";

export const CALLS_QUERY_KEY = ["calls"] as const;

export function syncLegacyCalls(list: Anruf[]) {
  INITIAL_ANRUFE.length = 0;
  INITIAL_ANRUFE.push(...list);
}

export function useCalls() {
  const fetchCalls = useServerFn(listCalls);
  return useQuery({
    queryKey: CALLS_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchCalls();
      syncLegacyCalls(data);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateCall() {
  const qc = useQueryClient();
  const fn = useServerFn(createCall);
  return useMutation({
    mutationFn: (values: CallWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CALLS_QUERY_KEY }),
  });
}

export function useUpdateCall() {
  const qc = useQueryClient();
  const fn = useServerFn(updateCall);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<CallWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CALLS_QUERY_KEY }),
  });
}

export function useDeleteCall() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteCall);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CALLS_QUERY_KEY }),
  });
}

export function useSeedCalls() {
  const qc = useQueryClient();
  const fn = useServerFn(seedCalls);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: CALLS_QUERY_KEY }),
  });
}
