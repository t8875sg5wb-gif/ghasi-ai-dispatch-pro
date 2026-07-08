// Browser store for driver shift calendar entries.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listShifts, createShift, updateShift, deleteShift } from "@/lib/shifts.functions";
import type { ShiftWrite } from "@/lib/shifts-shared";

export const SHIFTS_QUERY_KEY = ["driver_shifts"] as const;

export function useShifts() {
  const fn = useServerFn(listShifts);
  return useQuery({
    queryKey: SHIFTS_QUERY_KEY,
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  const fn = useServerFn(createShift);
  return useMutation({
    mutationFn: (values: ShiftWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY }),
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  const fn = useServerFn(updateShift);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<ShiftWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY }),
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteShift);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY }),
  });
}
