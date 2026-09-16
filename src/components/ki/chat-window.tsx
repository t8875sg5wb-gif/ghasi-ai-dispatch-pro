import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { Bot } from "lucide-react";

import { ChatMessage } from "@/components/ki/chat-message";
import { ChatComposer, type Attachment } from "@/components/ki/chat-composer";
import { useThreadMessages } from "@/hooks/use-threads";
import { takePending } from "@/lib/chat-pending";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { chatErrorMessage } from "@/lib/chat-errors";

const quickPrompts = [
  "Wie ist die Auslastung heute?",
  "Welcher Fahrer passt zu einem neuen Dialyse-Transport?",
  "Zeig mir die aktuellen News zum Gesundheitswesen.",
  "Schreibe eine freundliche E-Mail an einen Kunden.",
];

function ChatInner({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: UIMessage[];
}) {
  const qc = useQueryClient();
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { threadId },
        // Bearer-Token mitsenden, damit der Server Rolle & Berechtigungen prüfen kann.
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [threadId],
  );
  const [chatFehler, setChatFehler] = useState<string | null>(null);
  const sendErrorRef = useRef<Error | null>(null);
  const { messages, sendMessage, status } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onFinish: ({ isError }) => {
      if (!isError) setChatFehler(null);
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      qc.invalidateQueries({ queryKey: ["chat-messages", threadId] });
    },
    onError: (error) => {
      const normalized = error instanceof Error ? error : new Error(String(error));
      sendErrorRef.current = normalized;
      setChatFehler(chatErrorMessage(normalized));
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  const send = async (text: string, files: Attachment[]) => {
    setChatFehler(null);
    sendErrorRef.current = null;
    const fileParts = files.length ? files : undefined;
    if (text) await sendMessage({ text, files: fileParts });
    else if (fileParts) await sendMessage({ files: fileParts });
    if (sendErrorRef.current) throw new Error(chatErrorMessage(sendErrorRef.current));
  };

  // Erste Nachricht von der Startseite übernehmen.
  const consumed = useRef(false);
  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;
    const pending = takePending(threadId);
    if (pending) void send(pending.text, pending.files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => send(p, [])}
                className="rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}

        {status === "submitted" && (
          <div className="flex items-end gap-2.5">
            <div className="bg-gradient-primary flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="mx-auto max-w-xl rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <p className="font-medium">Nachricht konnte nicht gesendet werden.</p>
            <p className="mt-1 text-xs">
              {chatFehler ?? "Bitte erneut versuchen. Der eingegebene Entwurf bleibt erhalten."}
            </p>
          </div>
        )}
      </div>

      <ChatComposer onSend={send} busy={busy} />
    </div>
  );
}

export function ChatWindow({ threadId }: { threadId: string }) {
  const { data, isLoading } = useThreadMessages(threadId);

  if (isLoading || !data) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="ml-auto h-12 w-1/2" />
        <Skeleton className="h-20 w-3/4" />
      </div>
    );
  }

  // Key auf threadId -> sauberer Remount je Unterhaltung (kein Nachrichten-Leak).
  return <ChatInner key={threadId} threadId={threadId} initialMessages={data} />;
}
