// Browser store for persisted insurers (Krankenkassen). Mirrors into the legacy
// `KRANKENKASSEN` array so modules reading it synchronously reflect state.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { KRANKENKASSEN, type Krankenkasse } from "@/lib/stammdaten";
import {
  listInsurers,
  createInsurer,
  updateInsurer,
  deleteInsurer,
  seedInsurers,
} from "@/lib/insurers.functions";
import type { InsurerWrite } from "@/lib/insurers-shared";

export const INSURERS_QUERY_KEY = ["insurers"] as const;

export function syncLegacyInsurers(list: Krankenkasse[]) {
  KRANKENKASSEN.length = 0;
  KRANKENKASSEN.push(...list);
}

export function useInsurers() {
  const fetchInsurers = useServerFn(listInsurers);
  return useQuery({
    queryKey: INSURERS_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchInsurers();
      syncLegacyInsurers(data);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateInsurer() {
  const qc = useQueryClient();
  const fn = useServerFn(createInsurer);
  return useMutation({
    mutationFn: (values: InsurerWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSURERS_QUERY_KEY }),
  });
}

export function useUpdateInsurer() {
  const qc = useQueryClient();
  const fn = useServerFn(updateInsurer);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<InsurerWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSURERS_QUERY_KEY }),
  });
}

export function useDeleteInsurer() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteInsurer);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSURERS_QUERY_KEY }),
  });
}

export function useSeedInsurers() {
  const qc = useQueryClient();
  const fn = useServerFn(seedInsurers);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSURERS_QUERY_KEY }),
  });
}
