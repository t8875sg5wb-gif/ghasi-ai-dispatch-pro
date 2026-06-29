// Browser store for persisted recurring orders (Daueraufträge). Single source of
// truth via TanStack Query. On every successful fetch it mirrors the data into
// the legacy in-memory `DAUERAUFTRAEGE` array so modules that read it
// synchronously (AI tools, dispatch) reflect the persisted state.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { DAUERAUFTRAEGE, type Dauerauftrag } from "@/lib/dauerauftraege";
import {
  listRecurring,
  createRecurring,
  updateRecurring,
  deleteRecurring,
  seedRecurring,
  generateRecurringTransports,
} from "@/lib/recurring.functions";
import { dauerauftragToWrite, type RecurringWrite } from "@/lib/recurring-shared";
import { ORDERS_QUERY_KEY } from "@/lib/orders-store";

export const RECURRING_QUERY_KEY = ["recurring_orders"] as const;

/** Replace the contents of the shared legacy array in place (keeps the reference). */
export function syncLegacyRecurring(list: Dauerauftrag[]) {
  DAUERAUFTRAEGE.length = 0;
  DAUERAUFTRAEGE.push(...list);
}

export function useRecurring() {
  const fetchRecurring = useServerFn(listRecurring);
  return useQuery({
    queryKey: RECURRING_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchRecurring();
      syncLegacyRecurring(data);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  const fn = useServerFn(createRecurring);
  return useMutation({
    mutationFn: (d: Dauerauftrag) => fn({ data: dauerauftragToWrite(d) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_QUERY_KEY }),
  });
}

export function useUpdateRecurring() {
  const qc = useQueryClient();
  const fn = useServerFn(updateRecurring);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<RecurringWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_QUERY_KEY }),
  });
}

export function useDeleteRecurring() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteRecurring);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_QUERY_KEY }),
  });
}

export function useSeedRecurring() {
  const qc = useQueryClient();
  const fn = useServerFn(seedRecurring);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECURRING_QUERY_KEY }),
  });
}

export function useGenerateRecurring() {
  const qc = useQueryClient();
  const fn = useServerFn(generateRecurringTransports);
  return useMutation({
    mutationFn: (input: { id: string; vonISO: string; bisISO: string }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RECURRING_QUERY_KEY });
      qc.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}
