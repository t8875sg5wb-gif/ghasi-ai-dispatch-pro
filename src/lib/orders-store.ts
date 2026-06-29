// Browser store for persisted orders. Single source of truth via TanStack Query.
// On every successful fetch it also mirrors the data into the legacy in-memory
// `INITIAL_AUFTRAEGE` array so modules that still read it synchronously
// (Dispatch, Finance, AI Brain, Reporting, …) reflect the persisted state.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { INITIAL_AUFTRAEGE, type Auftrag } from "@/lib/auftraege";
import {
  listOrders,
  createOrder,
  updateOrder,
  deleteOrder,
  seedOrders,
} from "@/lib/orders.functions";
import type { OrderWrite } from "@/lib/orders-shared";

export const ORDERS_QUERY_KEY = ["orders"] as const;

/** Replace the contents of the shared legacy array in place (keeps the reference). */
export function syncLegacyOrders(list: Auftrag[]) {
  INITIAL_AUFTRAEGE.length = 0;
  INITIAL_AUFTRAEGE.push(...list);
}

export function useOrders() {
  const fetchOrders = useServerFn(listOrders);
  return useQuery({
    queryKey: ORDERS_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchOrders();
      syncLegacyOrders(data);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  const fn = useServerFn(createOrder);
  return useMutation({
    mutationFn: (values: OrderWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDERS_QUERY_KEY }),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  const fn = useServerFn(updateOrder);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<OrderWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDERS_QUERY_KEY }),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteOrder);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDERS_QUERY_KEY }),
  });
}

export function useSeedOrders() {
  const qc = useQueryClient();
  const fn = useServerFn(seedOrders);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ORDERS_QUERY_KEY }),
  });
}
