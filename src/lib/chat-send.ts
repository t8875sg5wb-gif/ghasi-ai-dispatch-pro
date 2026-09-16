import { chatErrorMessage } from "@/lib/chat-errors";

export interface ChatSendResult {
  ok: boolean;
  error: string | null;
}

export async function attemptChatSend<T>(
  send: (text: string, files: T[]) => void | Promise<void>,
  text: string,
  files: T[],
): Promise<ChatSendResult> {
  try {
    await send(text, files);
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: chatErrorMessage(error) };
  }
}
