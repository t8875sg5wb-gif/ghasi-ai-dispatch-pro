import type { Attachment } from "@/components/ki/chat-composer";

// Übergibt eine erste Nachricht von der Startseite an die neu erstellte
// Thread-Seite (ohne Reload, daher reicht ein Modul-Speicher im SPA).
const store = new Map<string, { text: string; files: Attachment[] }>();

export function setPending(id: string, value: { text: string; files: Attachment[] }) {
  store.set(id, value);
}

export function takePending(id: string) {
  const value = store.get(id);
  store.delete(id);
  return value;
}
