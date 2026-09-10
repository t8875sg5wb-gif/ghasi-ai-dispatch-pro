// Benachrichtigt Admins über neu abgelehnte Daueraufträge (Zeitpunkt + Grund)
// sowie über eine zu hohe Ablehnungsquote im Tagesverlauf.
//
// Läuft nur für Administratoren, weil das Ablehnungsprotokoll per RLS
// ausschließlich für Admins lesbar ist.
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getCompanySettings } from "@/lib/company-settings.functions";
import { pushNotification } from "@/lib/notifications";
import {
  ablehnungsBenachrichtigungen,
  ablehnungsquotenAlarm,
  bewerteAblehnungen,
} from "@/lib/recurring-rejection-analytics";
import { listRecurringRejections } from "@/lib/recurring-rejections.functions";

function tagesBeginn(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Erfolgreich gespeicherte Dauerauftragsvorgänge seit Tagesbeginn. */
async function ladeErfolgreicheHeute(): Promise<number> {
  const { count, error } = await supabase
    .from("activity_log")
    .select("id", { count: "exact", head: true })
    .eq("bereich", "Daueraufträge")
    .in("aktion", ["angelegt", "bearbeitet", "erstellt"])
    .gte("created_at", tagesBeginn(new Date()).toISOString());
  if (error) throw error;
  return count ?? 0;
}

export function useRejectionAlerts() {
  const { rollen, rollenGeladen } = useAuth();
  const istAdmin = rollenGeladen && rollen.includes("admin");
  const laden = useServerFn(listRecurringRejections);
  const ladeEinstellungen = useServerFn(getCompanySettings);

  const { data } = useQuery({
    queryKey: ["recurring_rejections", "alarm"],
    queryFn: () => laden({ data: { tage: 2, limit: 100 } }),
    enabled: istAdmin,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: false,
  });

  const { data: erfolgeHeute } = useQuery({
    queryKey: ["activity_log", "recurring_success", "quoten-alarm"],
    queryFn: ladeErfolgreicheHeute,
    enabled: istAdmin,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: false,
  });

  const { data: einstellungen } = useQuery({
    queryKey: ["company_settings", "quoten-alarm"],
    queryFn: () => ladeEinstellungen(),
    enabled: istAdmin,
    staleTime: 5 * 60_000,
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

  // Quoten-Alarm: überschreitet der Anteil abgelehnter Versuche heute den in
  // den Einstellungen konfigurierten Schwellenwert, wird gewarnt.
  useEffect(() => {
    if (!data || !einstellungen || erfolgeHeute === undefined) return;
    const beginn = tagesBeginn(new Date()).getTime();
    const heuteRows = data.filter((a) => {
      const t = new Date(a.zeitpunkt).getTime();
      return Number.isFinite(t) && t >= beginn;
    });
    const kennzahlen = bewerteAblehnungen(heuteRows, erfolgeHeute);
    const alarm = ablehnungsquotenAlarm(kennzahlen, {
      schwelleProzent: einstellungen.ablehnungsquoteSchwelleProzent,
      minVersuche: einstellungen.ablehnungsquoteMinVersuche,
      zeitraumLabel: "heute",
      zeitraumKey: new Date(beginn).toISOString().slice(0, 10),
    });
    if (!alarm) return;
    if (!pushNotification(alarm)) return;
    toast.warning(alarm.titel, {
      description: alarm.text,
      action: { label: "Bericht öffnen", onClick: () => window.location.assign(alarm.to) },
    });
  }, [data, einstellungen, erfolgeHeute]);
}
