import { Bot, User, Globe, BrainCircuit, FileText, ExternalLink, Search } from "lucide-react";
import type { UIMessage } from "ai";

import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ki/markdown";

interface WebQuelle {
  titel: string;
  url: string;
  auszug: string;
}

function QuellenListe({ treffer }: { treffer: WebQuelle[] }) {
  if (treffer.length === 0) return null;
  return (
    <div className="mt-1 space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Globe className="h-3.5 w-3.5 text-info" /> Online-Quellen
      </p>
      <div className="grid gap-1.5">
        {treffer.slice(0, 5).map((q) => (
          <a
            key={q.url}
            href={q.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-2.5 transition-colors hover:bg-muted/60"
          >
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium group-hover:text-primary">{q.titel}</span>
              {q.auszug && (
                <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{q.auszug}</span>
              )}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

function ToolHinweis({ icon: Icon, text }: { icon: typeof Globe; text: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-accent" /> {text}
    </p>
  );
}

export function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  const textParts = message.parts.filter((p) => p.type === "text") as { type: "text"; text: string }[];
  const text = textParts.map((p) => p.text).join("");
  const fileParts = message.parts.filter((p) => p.type === "file") as {
    type: "file";
    mediaType?: string;
    url: string;
    filename?: string;
  }[];

  return (
    <div className={cn("flex items-end gap-2.5", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-secondary text-secondary-foreground" : "bg-gradient-primary text-primary-foreground",
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div className={cn("flex max-w-[85%] flex-col gap-1.5", isUser && "items-end")}>
        {/* Datei-Anhänge */}
        {fileParts.length > 0 && (
          <div className={cn("flex flex-wrap gap-2", isUser && "justify-end")}>
            {fileParts.map((f, i) =>
              f.mediaType?.startsWith("image/") ? (
                <img
                  key={i}
                  src={f.url}
                  alt={f.filename ?? "Bild"}
                  className="max-h-44 rounded-xl border border-border/60 object-cover"
                />
              ) : (
                <span
                  key={i}
                  className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium"
                >
                  <FileText className="h-4 w-4 text-primary" />
                  {f.filename ?? "Dokument"}
                </span>
              ),
            )}
          </div>
        )}

        {/* Tool-Aktivität */}
        {!isUser &&
          message.parts.map((p, i) => {
            if (typeof p.type !== "string") return null;
            if (p.type.startsWith("tool-web_suche")) {
              const out =
                "output" in p && p.output && typeof p.output === "object"
                  ? (p.output as { treffer?: WebQuelle[]; verbunden?: boolean; fehler?: string })
                  : undefined;
              if (!out) return <ToolHinweis key={i} icon={Search} text="Sucht im Internet …" />;
              if (out.verbunden === false)
                return <ToolHinweis key={i} icon={Globe} text="Web-Zugriff nicht verbunden." />;
              return <QuellenListe key={i} treffer={out.treffer ?? []} />;
            }
            if (p.type.startsWith("tool-web_seite_lesen")) {
              return <ToolHinweis key={i} icon={Globe} text="Liest eine Webseite …" />;
            }
            if (p.type.startsWith("tool-gedaechtnis_speichern")) {
              const ok =
                "output" in p && (p.output as { gespeichert?: boolean } | undefined)?.gespeichert;
              if (ok)
                return (
                  <ToolHinweis key={i} icon={BrainCircuit} text="Ins Langzeitgedächtnis übernommen" />
                );
            }
            return null;
          })}

        {/* Text */}
        {text && (
          <div
            className={cn(
              "rounded-2xl px-4 py-2.5",
              isUser
                ? "rounded-br-md bg-primary text-primary-foreground"
                : "rounded-bl-md bg-muted text-foreground",
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
            ) : (
              <Markdown content={text} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
