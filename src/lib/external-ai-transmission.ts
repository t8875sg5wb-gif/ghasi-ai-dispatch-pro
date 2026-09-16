export type ExternalTextMessage = {
  role: "user" | "assistant";
  content: string;
};

export interface ExternalAiTransmission {
  scanText: string;
  messages: ExternalTextMessage[];
  strippedStructuredParts: number;
}

const MAX_SCAN_CHARS = 200_000;

function collectStrings(
  value: unknown,
  out: string[],
  state: { chars: number; overflow: boolean },
) {
  if (state.overflow || value == null) return;
  if (typeof value === "string") {
    state.chars += value.length;
    if (state.chars > MAX_SCAN_CHARS) {
      state.overflow = true;
      return;
    }
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, state);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, out, state);
    }
  }
}
export function prepareExternalAiTransmission(messages: unknown[]): ExternalAiTransmission {
  const allStrings: string[] = [];
  const state = { chars: 0, overflow: false };
  collectStrings(messages, allStrings, state);
  if (state.overflow) {
    throw new Error("Externer KI-Kontext ist zu groß für eine sichere Inhaltsprüfung.");
  }

  const safe: ExternalTextMessage[] = [];
  let strippedStructuredParts = 0;
  for (const raw of messages) {
    if (!raw || typeof raw !== "object") continue;
    const message = raw as { role?: unknown; parts?: unknown };
    if (message.role !== "user" && message.role !== "assistant") continue;
    if (!Array.isArray(message.parts)) continue;

    const textParts: string[] = [];
    for (const part of message.parts) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "text" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        textParts.push((part as { text: string }).text);
      } else {
        strippedStructuredParts += 1;
      }
    }
    const content = textParts.join("").trim();
    if (content) safe.push({ role: message.role, content });
  }

  return { scanText: allStrings.join("\n"), messages: safe, strippedStructuredParts };
}
