// Browser-Store für Beschäftigungsverhältnisse (Finanzbereich).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createEmployment,
  deleteEmployment,
  listEmploymentAudit,
  listEmployments,
  updateEmployment,
  verifyEmployment,
} from "@/lib/employment.functions";
import type { BeschaeftigungsverhaeltnisWrite } from "@/lib/employment-shared";

export const EMPLOYMENTS_QUERY_KEY = ["employment_relationships"] as const;
export const EMPLOYMENT_AUDIT_QUERY_KEY = ["employment_audit_log"] as const;

/** Nur für Rollen mit Berechtigung aufrufen (`enabled`), sonst 403-Fehler. */
export function useEmployments(enabled = true) {
  const fn = useServerFn(listEmployments);
  return useQuery({
    queryKey: EMPLOYMENTS_QUERY_KEY,
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });
}

export function useEmploymentAudit(enabled = true) {
  const fn = useServerFn(listEmploymentAudit);
  return useQuery({
    queryKey: EMPLOYMENT_AUDIT_QUERY_KEY,
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: EMPLOYMENTS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: EMPLOYMENT_AUDIT_QUERY_KEY });
  };
}

export function useCreateEmployment() {
  const fn = useServerFn(createEmployment);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (values: BeschaeftigungsverhaeltnisWrite) => fn({ data: values }),
    onSuccess: invalidate,
  });
}

export function useUpdateEmployment() {
  const fn = useServerFn(updateEmployment);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (args: { id: string; values: BeschaeftigungsverhaeltnisWrite }) =>
      fn({ data: args }),
    onSuccess: invalidate,
  });
}

export function useVerifyEmployment() {
  const fn = useServerFn(verifyEmployment);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}

export function useDeleteEmployment() {
  const fn = useServerFn(deleteEmployment);
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}
