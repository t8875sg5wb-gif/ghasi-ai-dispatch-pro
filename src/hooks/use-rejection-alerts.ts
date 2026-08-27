// Benachrichtigt Admins über neu abgelehnte Daueraufträge (Zeitpunkt + Grund).
//
// Läuft nur für Administratoren, weil das Ablehnungsprotokoll per RLS
// ausschließlich für Admins lesbar ist.
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useAuth } from "@/hooks/use-auth";
import { pushNotification } from "@/lib/notifications";
import { ablehnungsBenachrichtigungen } from "@/lib/recurring-rejection-analytics";
import { listRecurringRejections } from "@/lib/recurring-rejections.functions";

export function useRejectionAlerts() {
  const { rollen, rollenGeladen } = useAuth();
  const istAdmin = rollenGeladen && rollen.includes("admin");
  const laden = useServerFn(listRecurringRejections);

  const { data } = useQuery({
    queryKey: ["recurring_rejections", "alarm"],
    queryFn: () => laden({ data: { tage: 2, limit: 100 } }),
    enabled: istAdmin,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    for (const n of ablehnungsBenachrichtigungen(data)) pushNotification(n);
  }, [data]);
}
