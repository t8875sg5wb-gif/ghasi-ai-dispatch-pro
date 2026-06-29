// Konversationsansicht: vollständiger Nachrichtenverlauf einer Unterhaltung
// mit Absender/Empfänger, Zeitstempel, Anhängen, Bezug zum Ursprungsobjekt
// und manueller Antwort (kein automatischer Versand).
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Paperclip, Send, ArrowRight, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  KANAL_META,
  KATEGORIE_META,
  PRIORITAET_META,
  formatZeit,
  type Konversation,
} from "@/lib/communication";
import { sendeAntwort } from "@/lib/communication-store";

export function ConversationPanel({ konversation }: { konversation: Konversation }) {
  const [antwort, setAntwort] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const kanal = KANAL_META[konversation.kanal];
  const kat = KATEGORIE_META[konversation.kategorie];
  const prio = PRIORITAET_META[konversation.prioritaet];
  const KanalIcon = kanal.icon;
  const KatIcon = kat.icon;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [konversation.nachrichten.length, konversation.id]);

  const senden = () => {
    if (!antwort.trim()) return;
    sendeAntwort(konversation.id, antwort);
    setAntwort("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="border-b border-border/70 px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", kat.ring)}
          >
            <KatIcon className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold">{konversation.betreff}</p>
          <Badge variant="outline" className={cn("gap-1 text-[10px]", kanal.badge)}>
            <KanalIcon className="h-3 w-3" />
            {kanal.label}
          </Badge>
          <Badge variant="outline" className={cn("text-[10px]", prio.badge)}>
            {prio.label}
          </Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Mit: {konversation.partner}</span>
          {konversation.bezug && (
            <Link
              to={konversation.bezug.to}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              {konversation.bezug.label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {/* History */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
        {konversation.nachrichten.map((n) => (
          <div
            key={n.id}
            className={cn("flex flex-col gap-1", n.eigen ? "items-end" : "items-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                n.eigen
                  ? "bg-gradient-primary rounded-br-md text-primary-foreground"
                  : "rounded-bl-md bg-muted",
              )}
            >
              <p className="whitespace-pre-wrap">{n.text}</p>
              {n.anhaenge?.map((a) => (
                <span
                  key={a.id}
                  className={cn(
                    "mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px]",
                    n.eigen ? "bg-white/15" : "bg-card",
                  )}
                >
                  <FileText className="h-3 w-3" />
                  {a.name} · {a.groesse}
                </span>
              ))}
            </div>
            <span className="px-1 text-[10px] text-muted-foreground">
              {n.eigen ? "Sie" : n.von} → {n.an} · {formatZeit(n.zeit)}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Reply composer (manual send only) */}
      <div className="border-t border-border/70 p-3 sm:p-4">
        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            title="Anhang (in Vorbereitung)"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={antwort}
            onChange={(e) => setAntwort(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                senden();
              }
            }}
            rows={1}
            placeholder={`Antwort über ${kanal.label} …`}
            className="max-h-32 min-h-[40px] resize-none text-sm"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl"
            onClick={senden}
            disabled={!antwort.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
