import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Send, Sparkles, User, BrainCircuit } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ki-assistent")({
  head: () => ({
    meta: [
      { title: "KI-Assistent GHASI AI" },
      {
        name: "description",
        content:
          "Sprechen Sie mit GHASI AI, Ihrem digitalen Geschäftsführer – Fragen zu Aufträgen, Touren, Finanzen und Flotte in natürlicher Sprache.",
      },
    ],
  }),
  component: AssistantPage,
});

const greeting =
  "Guten Tag, ich bin GHASI AI – Ihr digitaler Geschäftsführer. Ich kenne Ihre Fahrer, Fahrzeuge, Aufträge, Patienten und Kunden, erinnere mich an frühere Entscheidungen und gebe Ihnen datenbasierte Empfehlungen. Wichtige Aktionen führe ich nie eigenmächtig aus – ich frage Sie vorher. Womit darf ich starten?";

const quickPrompts = [
  "Wie ist die Auslastung heute?",
  "Welcher Fahrer passt zu einem neuen Dialyse-Transport?",
  "Welche Fristen laufen demnächst ab?",
  "Wo kann ich Leerkilometer sparen?",
];

function textOf(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("");
}

function AssistantPage() {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = (value: string) => {
    const text = value.trim();
    if (!text || busy) return;
    void sendMessage({ text });
    setInput("");
  };

  return (
    <div className="animate-fade-in flex h-[calc(100vh-9rem)] flex-col gap-4">
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 shadow-card">
        <div className="flex items-center gap-3 border-b border-border/70 px-5 py-4">
          <div className="bg-gradient-primary flex h-11 w-11 items-center justify-center rounded-2xl shadow-glow">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">GHASI AI</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success" /> Online · Digitaler Geschäftsführer
            </p>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {/* Begrüßung */}
          <Bubble role="assistant" text={greeting} />

          {messages.map((m) => {
            const merkte =
              m.role === "assistant" &&
              m.parts.some(
                (p) =>
                  p.type === "tool-gedaechtnis_speichern" &&
                  "output" in p &&
                  (p.output as { gespeichert?: boolean } | undefined)?.gespeichert,
              );
            const text = textOf(m.parts as { type: string; text?: string }[]);
            if (!text && !merkte) return null;
            return (
              <div key={m.id} className="space-y-1.5">
                {text && <Bubble role={m.role === "user" ? "user" : "assistant"} text={text} />}
                {merkte && (
                  <p className="ml-11 flex items-center gap-1.5 text-xs text-accent">
                    <BrainCircuit className="h-3.5 w-3.5" /> Ins Langzeitgedächtnis übernommen
                  </p>
                )}
              </div>
            );
          })}

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
            <p className="text-center text-sm text-destructive">
              GHASI AI ist gerade nicht erreichbar. Bitte erneut versuchen.
            </p>
          )}
        </div>

        <div className="border-t border-border/70 p-3 sm:p-4">
          <div className="mb-2.5 flex flex-wrap gap-2">
            {quickPrompts.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                <Sparkles className="h-3 w-3 text-accent" />
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Fragen Sie GHASI AI …"
              rows={1}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl"
            />
            <Button
              onClick={() => send(input)}
              disabled={!input.trim() || busy}
              size="icon"
              className="h-11 w-11 shrink-0 rounded-2xl"
              aria-label="Senden"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "assistant"; text: string }) {
  return (
    <div className={cn("flex items-end gap-2.5", role === "user" && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          role === "assistant"
            ? "bg-gradient-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        {role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          role === "assistant"
            ? "rounded-bl-md bg-muted text-foreground"
            : "bg-primary text-primary-foreground rounded-br-md",
        )}
      >
        {text}
      </div>
    </div>
  );
}
