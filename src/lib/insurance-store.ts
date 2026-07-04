// Browser store for persisted insurance policies (Versicherungen). Mirrors into
// the legacy `INITIAL_VERSICHERUNGEN` array so modules reading it synchronously
// reflect persisted state.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { INITIAL_VERSICHERUNGEN, type Versicherung } from "@/lib/versicherungen";
import {
  listInsurance,
  createInsurance,
  updateInsurance,
  deleteInsurance,
  seedInsurance,
} from "@/lib/insurance.functions";
import type { InsuranceWrite } from "@/lib/insurance-shared";

export const INSURANCE_QUERY_KEY = ["insurance_policies"] as const;

export function syncLegacyInsurance(list: Versicherung[]) {
  INITIAL_VERSICHERUNGEN.length = 0;
  INITIAL_VERSICHERUNGEN.push(...list);
}

export function useInsurance() {
  const fetchInsurance = useServerFn(listInsurance);
  return useQuery({
    queryKey: INSURANCE_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchInsurance();
      syncLegacyInsurance(data);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateInsurance() {
  const qc = useQueryClient();
  const fn = useServerFn(createInsurance);
  return useMutation({
    mutationFn: (values: InsuranceWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSURANCE_QUERY_KEY }),
  });
}

export function useUpdateInsurance() {
  const qc = useQueryClient();
  const fn = useServerFn(updateInsurance);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<InsuranceWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSURANCE_QUERY_KEY }),
  });
}

export function useDeleteInsurance() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteInsurance);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSURANCE_QUERY_KEY }),
  });
}

export function useSeedInsurance() {
  const qc = useQueryClient();
  const fn = useServerFn(seedInsurance);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSURANCE_QUERY_KEY }),
  });
}
