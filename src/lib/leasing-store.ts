// Browser store for persisted leasing contracts (Leasingverträge). Mirrors into
// the legacy `INITIAL_LEASING` array so modules reading it synchronously reflect
// persisted state.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { INITIAL_LEASING, type Leasingvertrag } from "@/lib/leasing";
import {
  listLeasing,
  createLeasing,
  updateLeasing,
  deleteLeasing,
  seedLeasing,
} from "@/lib/leasing.functions";
import type { LeasingWrite } from "@/lib/leasing-shared";

export const LEASING_QUERY_KEY = ["leasing_contracts"] as const;

export function syncLegacyLeasing(list: Leasingvertrag[]) {
  INITIAL_LEASING.length = 0;
  INITIAL_LEASING.push(...list);
}

export function useLeasing() {
  const fetchLeasing = useServerFn(listLeasing);
  return useQuery({
    queryKey: LEASING_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchLeasing();
      syncLegacyLeasing(data);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateLeasing() {
  const qc = useQueryClient();
  const fn = useServerFn(createLeasing);
  return useMutation({
    mutationFn: (values: LeasingWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LEASING_QUERY_KEY }),
  });
}

export function useUpdateLeasing() {
  const qc = useQueryClient();
  const fn = useServerFn(updateLeasing);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<LeasingWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LEASING_QUERY_KEY }),
  });
}

export function useDeleteLeasing() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteLeasing);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LEASING_QUERY_KEY }),
  });
}

export function useSeedLeasing() {
  const qc = useQueryClient();
  const fn = useServerFn(seedLeasing);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: LEASING_QUERY_KEY }),
  });
}
