// Statusabfrage für externe Verbindungen. Gibt bewusst nur Booleans zurück –
// niemals Keys oder Teile davon.
import { createServerFn } from "@tanstack/react-start";

export const getWebZugriffStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { istWebZugriffKonfiguriert } = await import("@/lib/web-search.server");
  return { konfiguriert: istWebZugriffKonfiguriert() };
});
