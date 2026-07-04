// Browser store for persisted vehicles. Mirrors into the legacy
// `INITIAL_FAHRZEUGE` array so modules still reading it synchronously
// (AI Brain, CEO intelligence, communication, …) reflect persisted state.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { INITIAL_FAHRZEUGE, type Fahrzeug } from "@/lib/fahrzeuge";
import {
  listVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  seedVehicles,
} from "@/lib/vehicles.functions";
import type { VehicleWrite } from "@/lib/vehicles-shared";

export const VEHICLES_QUERY_KEY = ["vehicles"] as const;

export function syncLegacyVehicles(list: Fahrzeug[]) {
  INITIAL_FAHRZEUGE.length = 0;
  INITIAL_FAHRZEUGE.push(...list);
}

export function useVehicles() {
  const fetchVehicles = useServerFn(listVehicles);
  return useQuery({
    queryKey: VEHICLES_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchVehicles();
      syncLegacyVehicles(data);
      return data;
    },
    staleTime: 15_000,
  });
}

export function useCreateVehicle() {
  const qc = useQueryClient();
  const fn = useServerFn(createVehicle);
  return useMutation({
    mutationFn: (values: VehicleWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
  });
}

export function useUpdateVehicle() {
  const qc = useQueryClient();
  const fn = useServerFn(updateVehicle);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<VehicleWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
  });
}

export function useDeleteVehicle() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteVehicle);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
  });
}

export function useSeedVehicles() {
  const qc = useQueryClient();
  const fn = useServerFn(seedVehicles);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
  });
}
