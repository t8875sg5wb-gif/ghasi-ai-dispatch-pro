// Browser store for the per-vehicle mileage log (Fahrtenbuch).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listTrips, createTrip, deleteTrip } from "@/lib/trips.functions";
import type { FahrtWrite } from "@/lib/trips-shared";

export const TRIPS_QUERY_KEY = ["vehicle_trips"] as const;

export function useTrips() {
  const fn = useServerFn(listTrips);
  return useQuery({
    queryKey: TRIPS_QUERY_KEY,
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}

export function useCreateTrip() {
  const qc = useQueryClient();
  const fn = useServerFn(createTrip);
  return useMutation({
    mutationFn: (values: FahrtWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TRIPS_QUERY_KEY }),
  });
}

export function useDeleteTrip() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteTrip);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: TRIPS_QUERY_KEY }),
  });
}
