// Browser store für ärztliche Verordnungen.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  listVerordnungen,
  createVerordnung,
  updateVerordnung,
  deleteVerordnung,
} from "@/lib/verordnungen.functions";
import type { VerordnungWrite } from "@/lib/verordnungen-shared";

export const VERORDNUNGEN_QUERY_KEY = ["verordnungen"] as const;

export function useVerordnungen() {
  const fetchVerordnungen = useServerFn(listVerordnungen);
  return useQuery({
    queryKey: VERORDNUNGEN_QUERY_KEY,
    queryFn: () => fetchVerordnungen(),
    staleTime: 30_000,
  });
}

export function useCreateVerordnung() {
  const qc = useQueryClient();
  const fn = useServerFn(createVerordnung);
  return useMutation({
    mutationFn: (values: Partial<VerordnungWrite>) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: VERORDNUNGEN_QUERY_KEY }),
  });
}

export function useUpdateVerordnung() {
  const qc = useQueryClient();
  const fn = useServerFn(updateVerordnung);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<VerordnungWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: VERORDNUNGEN_QUERY_KEY }),
  });
}

export function useDeleteVerordnung() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteVerordnung);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: VERORDNUNGEN_QUERY_KEY }),
  });
}
