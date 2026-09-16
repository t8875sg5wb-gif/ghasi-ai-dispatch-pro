import { chatErrorMessage } from "@/lib/chat-errors";

describe("chatErrorMessage", () => {
  test("liest API-Fehler aus JSON", () => {
    expect(chatErrorMessage(new Error('{"error":"Kein Zugriff auf diese Unterhaltung."}'))).toBe(
      "Kein Zugriff auf diese Unterhaltung.",
    );
  });

  test("erkl?rt chat_threads-RLS verst?ndlich", () => {
    const msg = chatErrorMessage(
      new Error('new row violates row-level security policy for table "chat_threads"'),
    );
    expect(msg).toContain("Chat-RLS-Migration");
  });

  test("erkl?rt fehlenden Service-Role-Key ohne Secretwert", () => {
    const msg = chatErrorMessage(new Error("Missing SUPABASE_SERVICE_ROLE_KEY"));
    expect(msg).toContain("serverseitige GHASI-Konfiguration");
    expect(msg).not.toContain("Missing SUPABASE_SERVICE_ROLE_KEY");
  });
});
