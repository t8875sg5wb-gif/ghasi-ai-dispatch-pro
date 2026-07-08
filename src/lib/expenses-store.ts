// Browser store for the expenses (Ausgaben) domain.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  seedExpenses,
} from "@/lib/expenses.functions";
import type { AusgabeWrite } from "@/lib/expenses-shared";

export const EXPENSES_QUERY_KEY = ["expenses"] as const;

export function useExpenses() {
  const fn = useServerFn(listExpenses);
  return useQuery({
    queryKey: EXPENSES_QUERY_KEY,
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  const fn = useServerFn(createExpense);
  return useMutation({
    mutationFn: (values: AusgabeWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY }),
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  const fn = useServerFn(updateExpense);
  return useMutation({
    mutationFn: (vars: { id: string; values: Partial<AusgabeWrite> }) => fn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY }),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteExpense);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY }),
  });
}

export function useSeedExpenses() {
  const qc = useQueryClient();
  const fn = useServerFn(seedExpenses);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXPENSES_QUERY_KEY }),
  });
}
