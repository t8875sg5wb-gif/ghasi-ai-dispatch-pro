import { attemptChatSend } from "@/lib/chat-send";

describe("attemptChatSend", () => {
  test("meldet Erfolg erst nach erfolgreichem Sender", async () => {
    const result = await attemptChatSend(async () => undefined, "Hallo", [] as string[]);
    expect(result).toEqual({ ok: true, error: null });
  });

  test("liefert bei Fehler ok=false, damit der Composer den Entwurf nicht leert", async () => {
    const result = await attemptChatSend(
      async () => {
        throw new Error('{"error":"RLS blockiert"}');
      },
      "Nicht verlieren",
      [] as string[],
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("RLS blockiert");
  });
});
