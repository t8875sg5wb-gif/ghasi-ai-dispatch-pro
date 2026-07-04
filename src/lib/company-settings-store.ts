// Browser store for company-wide settings (Firmenstammdaten & Steuerprofil).
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  getCompanySettings,
  saveCompanySettings,
  DEFAULT_COMPANY_SETTINGS,
  type CompanySettings,
} from "@/lib/company-settings.functions";

export const COMPANY_SETTINGS_QUERY_KEY = ["company-settings"] as const;

export function useCompanySettings() {
  const fetchSettings = useServerFn(getCompanySettings);
  return useQuery({
    queryKey: COMPANY_SETTINGS_QUERY_KEY,
    queryFn: () => fetchSettings(),
    initialData: DEFAULT_COMPANY_SETTINGS,
    staleTime: 60_000,
  });
}

export function useSaveCompanySettings() {
  const qc = useQueryClient();
  const fn = useServerFn(saveCompanySettings);
  return useMutation({
    mutationFn: (values: CompanySettings) => fn({ data: values }),
    onSuccess: (saved) => {
      qc.setQueryData(COMPANY_SETTINGS_QUERY_KEY, saved);
      qc.invalidateQueries({ queryKey: COMPANY_SETTINGS_QUERY_KEY });
    },
  });
}
