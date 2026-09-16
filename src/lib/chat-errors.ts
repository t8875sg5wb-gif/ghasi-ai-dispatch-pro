export function chatErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (!raw) return "Unbekannter Chat-Fehler.";
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error.trim();
  } catch {
    // Response war kein JSON; Rohtext bleibt die beste verf?gbare Diagnose.
  }
  if (raw.includes("row-level security") && raw.includes("chat_threads")) {
    return "Unterhaltung konnte wegen der Datenbank-Berechtigung nicht gespeichert werden. Die Chat-RLS-Migration muss gepr?ft werden.";
  }
  if (raw.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return "Die serverseitige GHASI-Konfiguration ist unvollst?ndig. Der Entwurf wurde nicht verworfen.";
  }
  return raw;
}
