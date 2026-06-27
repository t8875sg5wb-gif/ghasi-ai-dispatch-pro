// Browser store for persisted drivers. Single source of truth via TanStack Query.
// On every successful fetch it also mirrors the data into the legacy in-memory
// `INITIAL_FAHRER` array so modules that still read it synchronously
// (Dispatch, AI Brain, …) reflect the persisted state. A short refetch interval
// keeps driver status updates flowing live across the app.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { INITIAL_FAHRER, type Fahrer } from "@/lib/fahrer";
import {
  listDrivers,
  createDriver,
  updateDriver,
  deleteDriver,
  seedDrivers,
} from "@/lib/drivers.functions";
import type { DriverWrite } from "@/lib/drivers-shared";

export const DRIVERS_QUERY_KEY = ["drivers"] as const;

/** Replace the contents of the shared legacy array in place (keeps the reference). */
export function syncLegacyDrivers(list: Fahrer[]) {
  INITIAL_FAHRER.length = 0;
  INITIAL_FAHRER.push(...list);
}

export function useDrivers() {
  const fetchDrivers = useServerFn(listDrivers);
  return useQuery({
    queryKey: DRIVERS_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchDrivers();
      syncLegacyDrivers(data);
      return data;
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useCreateDriver() {
  const qc = useQueryClient();
  const fn = useServerFn(createDriver);
  return useMutation({
    mutationFn: (values: DriverWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY }),
  });
}

export function useUpdateDriver() {
  const qc = useQueryClient();
  const fn = useServerFn(updateDriver);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<DriverWrite> }) =>
      fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY }),
  });
}

export function useDeleteDriver() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteDriver);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY }),
  });
}

export function useSeedDrivers() {
  const qc = useQueryClient();
  const fn = useServerFn(seedDrivers);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: DRIVERS_QUERY_KEY }),
  });
}
