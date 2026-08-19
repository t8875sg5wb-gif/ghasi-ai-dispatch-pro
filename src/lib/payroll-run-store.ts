// Browser-Store für Lohnläufe (Finanzbereich): Anlegen und Berechnen.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  approvePayrollRun,
  calculatePayrollRun,
  createPayrollRun,
  deletePayrollRun,
  exportPayrollRunDatev,
  exportPayrollRunPdf,
  listPayrollRunAudit,
  listPayrollRuns,
  rejectPayrollRun,
  submitPayrollRun,
} from "@/lib/payroll-run.functions";
import type { LohnlaufWrite } from "@/lib/payroll-run-shared";

export const PAYROLL_RUNS_QUERY_KEY = ["payroll_runs"] as const;
export const PAYROLL_RUN_AUDIT_QUERY_KEY = ["payroll_run_audit_log"] as const;

/** Nur für berechtigte Rollen aufrufen (`enabled`), sonst Zugriffsfehler. */
export function usePayrollRuns(enabled = true) {
  const fn = useServerFn(listPayrollRuns);
  return useQuery({
    queryKey: PAYROLL_RUNS_QUERY_KEY,
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });
}

export function usePayrollRunAudit(enabled = true) {
  const fn = useServerFn(listPayrollRunAudit);
  return useQuery({
    queryKey: PAYROLL_RUN_AUDIT_QUERY_KEY,
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });
}

function useInvalidateRuns() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: PAYROLL_RUNS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: PAYROLL_RUN_AUDIT_QUERY_KEY });
  };
}

export function useCreatePayrollRun() {
  const fn = useServerFn(createPayrollRun);
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (values: LohnlaufWrite) => fn({ data: values }),
    onSuccess: invalidate,
  });
}

export function useCalculatePayrollRun() {
  const fn = useServerFn(calculatePayrollRun);
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}

export function useDeletePayrollRun() {
  const fn = useServerFn(deletePayrollRun);
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}

export function useSubmitPayrollRun() {
  const fn = useServerFn(submitPayrollRun);
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}

export function useApprovePayrollRun() {
  const fn = useServerFn(approvePayrollRun);
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}

export function useRejectPayrollRun() {
  const fn = useServerFn(rejectPayrollRun);
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (args: { id: string; grund: string }) => fn({ data: args }),
    onSuccess: invalidate,
  });
}

/** Freigegebenen Lohnlauf für den PDF-Export laden (Rolle + Status serverseitig geprüft, protokolliert). */
export function useExportPayrollRunPdf() {
  const fn = useServerFn(exportPayrollRunPdf);
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}

/**
 * Freigegebenen Lohnlauf für den DATEV-Lohn-Exportentwurf laden
 * (Rolle + Status serverseitig geprüft, protokolliert). Enthält
 * Platzhalter-Lohnarten – nicht ungeprüft in DATEV importieren.
 */
export function useExportPayrollRunDatev() {
  const fn = useServerFn(exportPayrollRunDatev);
  const invalidate = useInvalidateRuns();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}

