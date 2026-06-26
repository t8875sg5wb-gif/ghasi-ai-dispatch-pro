// Client-Helfer: feuert Protokoll-Einträge ab (fire-and-forget) und
// invalidiert die Aktivitäten-Abfrage, ohne den UI-Fluss zu blockieren.
import { protokolliere, type ProtokollInput } from "@/lib/ghasi.functions";

export function logActivity(input: ProtokollInput) {
  void protokolliere({ data: input }).catch((e) =>
    console.warn("[GHASI] Protokoll fehlgeschlagen:", e),
  );
}
