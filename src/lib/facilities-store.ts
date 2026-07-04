// Browser store for persisted facilities (Einrichtungen). Mirrors into the
// legacy KRANKENHAEUSER / DIALYSEZENTREN / PFLEGEHEIME arrays (split by typ) so
// modules still reading them synchronously reflect persisted state.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  KRANKENHAEUSER,
  DIALYSEZENTREN,
  PFLEGEHEIME,
  type Einrichtung,
} from "@/lib/stammdaten";
import {
  listFacilities,
  createFacility,
  updateFacility,
  deleteFacility,
  seedFacilities,
} from "@/lib/facilities.functions";
import type { FacilityWrite } from "@/lib/facilities-shared";

export const FACILITIES_QUERY_KEY = ["facilities"] as const;

export function syncLegacyFacilities(list: Einrichtung[]) {
  const kh = list.filter((e) => e.typ === "krankenhaus");
  const dz = list.filter((e) => e.typ === "dialyse");
  const ph = list.filter((e) => e.typ === "pflegeheim");
  KRANKENHAEUSER.length = 0;
  KRANKENHAEUSER.push(...kh);
  DIALYSEZENTREN.length = 0;
  DIALYSEZENTREN.push(...dz);
  PFLEGEHEIME.length = 0;
  PFLEGEHEIME.push(...ph);
}

export function useFacilities() {
  const fetchFacilities = useServerFn(listFacilities);
  return useQuery({
    queryKey: FACILITIES_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchFacilities();
      syncLegacyFacilities(data);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateFacility() {
  const qc = useQueryClient();
  const fn = useServerFn(createFacility);
  return useMutation({
    mutationFn: (values: FacilityWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: FACILITIES_QUERY_KEY }),
  });
}

export function useUpdateFacility() {
  const qc = useQueryClient();
  const fn = useServerFn(updateFacility);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<FacilityWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: FACILITIES_QUERY_KEY }),
  });
}

export function useDeleteFacility() {
  const qc = useQueryClient();
  const fn = useServerFn(deleteFacility);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: FACILITIES_QUERY_KEY }),
  });
}

export function useSeedFacilities() {
  const qc = useQueryClient();
  const fn = useServerFn(seedFacilities);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: FACILITIES_QUERY_KEY }),
  });
}
