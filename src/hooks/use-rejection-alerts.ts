// Benachrichtigt Admins über neu abgelehnte Daueraufträge (Zeitpunkt + Grund).
//
// Läuft nur für Administratoren, weil das Ablehnungsprotokoll per RLS
// ausschließlich für Admins lesbar ist.
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

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
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });

  // Beim ersten Laden nur stumm nachziehen – Kurzhinweise erscheinen nur für
  // Ablehnungen, die während der laufenden Sitzung neu dazukommen.
  const ersterLauf = useRef(true);

  useEffect(() => {
    if (!data) return;
    const neue = ablehnungsBenachrichtigungen(data).filter((n) => pushNotification(n));
    if (ersterLauf.current) {
      ersterLauf.current = false;
      return;
    }
    for (const n of neue.slice(0, 3)) {
      toast.warning(n.titel, {
        description: n.text,
        action: { label: "Bericht öffnen", onClick: () => window.location.assign(n.to) },
      });
    }
  }, [data]);
}
