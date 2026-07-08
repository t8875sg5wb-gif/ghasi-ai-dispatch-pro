// Server function for opt-in real GPS position sharing from the driver's
// mobile view. A driver may only update the position of the vehicle they are
// assigned to. RLS additionally restricts writes to admin/disposition/fahrer.
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface PositionInput {
  lat: number;
  lng: number;
}

export interface PositionResult {
  ok: boolean;
  vehicleId?: string;
  kennzeichen?: string;
  fehler?: string;
}

export const updateMyVehiclePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: PositionInput) => {
    if (typeof data?.lat !== "number" || typeof data?.lng !== "number") {
      throw new Error("lat/lng sind erforderlich");
    }
    if (Math.abs(data.lat) > 90 || Math.abs(data.lng) > 180) {
      throw new Error("Ungültige Koordinaten");
    }
    return data;
  })
  .handler(async ({ data, context }): Promise<PositionResult> => {
    const { supabase, userId } = context;

    // Resolve the driver's display name (vehicles.fahrer stores the name).
    const { data: profil } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    const name = (profil as { name: string } | null)?.name?.trim();
    if (!name) {
      return { ok: false, fehler: "Kein Fahrerprofil gefunden." };
    }

    // Find the vehicle assigned to this driver.
    const { data: fahrzeug, error: findErr } = await supabase
      .from("vehicles")
      .select("id, kennzeichen, fahrer")
      .eq("fahrer", name)
      .maybeSingle();
    if (findErr) return { ok: false, fehler: findErr.message };
    if (!fahrzeug) {
      return { ok: false, fehler: "Ihnen ist aktuell kein Fahrzeug zugewiesen." };
    }

    const { error: updErr } = await supabase
      .from("vehicles")
      .update({
        last_real_lat: data.lat,
        last_real_lng: data.lng,
        last_real_at: new Date().toISOString(),
      } as never)
      .eq("id", (fahrzeug as { id: string }).id);
    if (updErr) return { ok: false, fehler: updErr.message };

    return {
      ok: true,
      vehicleId: (fahrzeug as { id: string }).id,
      kennzeichen: (fahrzeug as { kennzeichen: string }).kennzeichen,
    };
  });
