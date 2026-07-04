// Browser store for persisted patients. Mirrors into the legacy `PATIENTEN`
// array so modules still reading it synchronously reflect persisted state.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { PATIENTEN, type Patient } from "@/lib/stammdaten";
import {
  listPatients,
  createPatient,
  updatePatient,
  deletePatient,
  seedPatients,
} from "@/lib/patients.functions";
import type { PatientWrite } from "@/lib/patients-shared";

export const PATIENTS_QUERY_KEY = ["patients"] as const;

export function syncLegacyPatients(list: Patient[]) {
  PATIENTEN.length = 0;
  PATIENTEN.push(...list);
}

export function usePatients() {
  const fetchPatients = useServerFn(listPatients);
  return useQuery({
    queryKey: PATIENTS_QUERY_KEY,
    queryFn: async () => {
      const data = await fetchPatients();
      syncLegacyPatients(data);
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  const fn = useServerFn(createPatient);
  return useMutation({
    mutationFn: (values: PatientWrite) => fn({ data: values }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY }),
  });
}

export function useUpdatePatient() {
  const qc = useQueryClient();
  const fn = useServerFn(updatePatient);
  return useMutation({
    mutationFn: (input: { id: string; values: Partial<PatientWrite> }) => fn({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY }),
  });
}

export function useDeletePatient() {
  const qc = useQueryClient();
  const fn = useServerFn(deletePatient);
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY }),
  });
}

export function useSeedPatients() {
  const qc = useQueryClient();
  const fn = useServerFn(seedPatients);
  return useMutation({
    mutationFn: () => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: PATIENTS_QUERY_KEY }),
  });
}
