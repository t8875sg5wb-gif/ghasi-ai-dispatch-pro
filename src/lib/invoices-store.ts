// Browser store for persisted invoices. Single source of truth via TanStack
// Query. On every successful fetch it mirrors the data into the legacy in-memory
// `INITIAL_RECHNUNGEN` array so modules that still read it synchronously
// (Finance KPIs, anomaly detection, reporting, AI snapshot) reflect the
// persisted state.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listInvoiceChanges } from "@/lib/invoices.functions";

import { INITIAL_RECHNUNGEN, type Rechnung } from "@/lib/finance";
import {
  listInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  seedInvoices,
  generateBillingDrafts,
} from "@/lib/invoices.functions";
import type { InvoiceWrite } from "@/lib/invoices-shared";

export const INVOICES_QUERY_KEY = ["invoices"] as const;

/** Replace the contents of the shared legacy array in place (keeps the reference). */
export function syncLegacyInvoices(list: Rechnung[]) {
  INITIAL_RECHNUNGEN.length = 0;
  INITIAL_RECHNUNGEN.push(...list);
}

export function useInvoices() {
  const fetchInvoices = useServerFn(listInvoices);
  return useQuery({
    queryKey: INVOICES_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchInvoices();
      syncLegacyInvoices(data);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  const fn = useServerFn(createInvoice);
  return useMutation({
    mutationFn: (values: InvoiceWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVOICES_QUERY_KEY }),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  const fn = useServerFn(updateInvoice);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<InvoiceWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVOICES_QUERY_KEY }),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteInvoice);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVOICES_QUERY_KEY }),
  });
}

export function useSeedInvoices() {
  const qc = useQueryClient();
  const fn = useServerFn(seedInvoices);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVOICES_QUERY_KEY }),
  });
}

export function useGenerateBillingDrafts() {
  const qc = useQueryClient();
  const fn = useServerFn(generateBillingDrafts);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVOICES_QUERY_KEY }),
  });
}

export function useInvoiceChanges(invoiceId: string | null) {
  const fn = useServerFn(listInvoiceChanges);
  return useQuery({
    queryKey: ["invoice-changes", invoiceId],
    queryFn: () => fn({ data: { invoiceId: invoiceId as string } }),
    enabled: !!invoiceId,
    staleTime: 10_000,
  });
}
