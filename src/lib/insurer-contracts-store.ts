// Browser store for insurer contracts (Kassenverträge).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  listInsurerContracts,
  createInsurerContract,
  deleteInsurerContract,
} from "@/lib/insurer-contracts.functions";
import type { KassenvertragWrite } from "@/lib/insurer-contracts-shared";

export const INSURER_CONTRACTS_QUERY_KEY = ["insurer_contracts"] as const;

export function useInsurerContracts() {
  const fn = useServerFn(listInsurerContracts);
  return useQuery({
    queryKey: INSURER_CONTRACTS_QUERY_KEY,
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}

export function useCreateInsurerContract() {
  const qc = useQueryClient();
  const fn = useServerFn(createInsurerContract);
  return useMutation({
    mutationFn: (values: KassenvertragWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSURER_CONTRACTS_QUERY_KEY }),
  });
}

export function useDeleteInsurerContract() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteInsurerContract);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INSURER_CONTRACTS_QUERY_KEY }),
  });
}
