// Live option lists for driver / vehicle / customer selects, sourced from the
// persisted stores (never demo constants). Each hook returns the options plus
// an empty-state hint so dropdowns can guide the user to create data first.
import { useMemo } from "react";

import { useDrivers } from "@/lib/drivers-store";
import { useVehicles } from "@/lib/vehicles-store";
import { useCustomers } from "@/lib/customers-store";

export interface EntityOption {
  value: string;
  label: string;
}

export interface EntityOptions {
  options: EntityOption[];
  /** true when no entities exist yet */
  leer: boolean;
  /** hint to show when the list is empty */
  hinweis: string;
}

export function useDriverOptions(): EntityOptions {
  const { data } = useDrivers();
  return useMemo(() => {
    const list = data ?? [];
    return {
      options: list.map((f) => ({ value: f.name, label: `${f.name} · ${f.nummer}` })),
      leer: list.length === 0,
      hinweis: "Noch keine Fahrer angelegt – zuerst unter „Fahrer“ anlegen oder Beispieldaten laden.",
    };
  }, [data]);
}

export function useVehicleOptions(): EntityOptions {
  const { data } = useVehicles();
  return useMemo(() => {
    const list = data ?? [];
    return {
      options: list.map((v) => ({
        value: v.kennzeichen,
        label: `${v.kennzeichen} · ${v.marke} ${v.modell}`,
      })),
      leer: list.length === 0,
      hinweis:
        "Noch keine Fahrzeuge angelegt – zuerst unter „Fahrzeuge“ anlegen oder Beispieldaten laden.",
    };
  }, [data]);
}

export function useCustomerOptions(): EntityOptions {
  const { data } = useCustomers();
  return useMemo(() => {
    const list = data ?? [];
    return {
      options: list.map((k) => ({ value: k.name, label: k.name })),
      leer: list.length === 0,
      hinweis:
        "Noch keine Kunden angelegt – zuerst unter „Kunden“ anlegen oder Beispieldaten laden.",
    };
  }, [data]);
}
