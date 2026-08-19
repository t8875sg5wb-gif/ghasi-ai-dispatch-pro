// Browser-Store für Lohn-Eingabefakten und Lohn-Regelwerke (Finanzbereich).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  createPayrollFact,
  createPayrollRule,
  deletePayrollFact,
  deletePayrollRule,
  listPayrollFactAudit,
  listPayrollFacts,
  listPayrollRuleAudit,
  listPayrollRules,
  updatePayrollFact,
  updatePayrollRule,
  verifyPayrollFact,
  verifyPayrollRule,
} from "@/lib/payroll.functions";
import type { LohnFaktWrite, LohnRegelWrite } from "@/lib/payroll-shared";

export const PAYROLL_FACTS_QUERY_KEY = ["payroll_facts"] as const;
export const PAYROLL_FACT_AUDIT_QUERY_KEY = ["payroll_fact_audit_log"] as const;
export const PAYROLL_RULES_QUERY_KEY = ["payroll_rules"] as const;
export const PAYROLL_RULE_AUDIT_QUERY_KEY = ["payroll_rule_audit_log"] as const;

/* -------------------- Lohn-Eingabefakten -------------------- */

/** Nur für Rollen mit Berechtigung aufrufen (`enabled`), sonst Zugriffsfehler. */
export function usePayrollFacts(enabled = true) {
  const fn = useServerFn(listPayrollFacts);
  return useQuery({
    queryKey: PAYROLL_FACTS_QUERY_KEY,
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });
}

export function usePayrollFactAudit(enabled = true) {
  const fn = useServerFn(listPayrollFactAudit);
  return useQuery({
    queryKey: PAYROLL_FACT_AUDIT_QUERY_KEY,
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });
}

function useInvalidateFacts() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: PAYROLL_FACTS_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: PAYROLL_FACT_AUDIT_QUERY_KEY });
  };
}

export function useCreatePayrollFact() {
  const fn = useServerFn(createPayrollFact);
  const invalidate = useInvalidateFacts();
  return useMutation({
    mutationFn: (values: LohnFaktWrite) => fn({ data: values }),
    onSuccess: invalidate,
  });
}

export function useUpdatePayrollFact() {
  const fn = useServerFn(updatePayrollFact);
  const invalidate = useInvalidateFacts();
  return useMutation({
    mutationFn: (args: { id: string; values: LohnFaktWrite }) => fn({ data: args }),
    onSuccess: invalidate,
  });
}

export function useVerifyPayrollFact() {
  const fn = useServerFn(verifyPayrollFact);
  const invalidate = useInvalidateFacts();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}

export function useDeletePayrollFact() {
  const fn = useServerFn(deletePayrollFact);
  const invalidate = useInvalidateFacts();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}

/* -------------------- Lohn-Regelwerke -------------------- */

export function usePayrollRules(enabled = true) {
  const fn = useServerFn(listPayrollRules);
  return useQuery({
    queryKey: PAYROLL_RULES_QUERY_KEY,
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });
}

export function usePayrollRuleAudit(enabled = true) {
  const fn = useServerFn(listPayrollRuleAudit);
  return useQuery({
    queryKey: PAYROLL_RULE_AUDIT_QUERY_KEY,
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });
}

function useInvalidateRules() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: PAYROLL_RULES_QUERY_KEY });
    void qc.invalidateQueries({ queryKey: PAYROLL_RULE_AUDIT_QUERY_KEY });
  };
}

export function useCreatePayrollRule() {
  const fn = useServerFn(createPayrollRule);
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (values: LohnRegelWrite) => fn({ data: values }),
    onSuccess: invalidate,
  });
}

export function useUpdatePayrollRule() {
  const fn = useServerFn(updatePayrollRule);
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (args: { id: string; values: LohnRegelWrite }) => fn({ data: args }),
    onSuccess: invalidate,
  });
}

export function useVerifyPayrollRule() {
  const fn = useServerFn(verifyPayrollRule);
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}

export function useDeletePayrollRule() {
  const fn = useServerFn(deletePayrollRule);
  const invalidate = useInvalidateRules();
  return useMutation({
    mutationFn: (id: string) => fn({ data: { id } }),
    onSuccess: invalidate,
  });
}
