// Browser store for persisted customers. Mirrors into the legacy `KUNDEN`
// array so modules still reading it synchronously reflect persisted state.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { KUNDEN, type Kunde } from "@/lib/stammdaten";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  seedCustomers,
} from "@/lib/customers.functions";
import type { CustomerWrite } from "@/lib/customers-shared";

export const CUSTOMERS_QUERY_KEY = ["customers"] as const;

export function syncLegacyCustomers(list: Kunde[]) {
  KUNDEN.length = 0;
  KUNDEN.push(...list);
}

export function useCustomers() {
  const fetchCustomers = useServerFn(listCustomers);
  return useQuery({
    queryKey: CUSTOMERS_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchCustomers();
      syncLegacyCustomers(data);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  const fn = useServerFn(createCustomer);
  return useMutation({
    mutationFn: (values: CustomerWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  const fn = useServerFn(updateCustomer);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<CustomerWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteCustomer);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY }),
  });
}

export function useSeedCustomers() {
  const qc = useQueryClient();
  const fn = useServerFn(seedCustomers);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY }),
  });
}
