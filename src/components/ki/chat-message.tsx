import { useState } from "react";
import {
  Bot,
  User,
  Globe,
  BrainCircuit,
  FileText,
  ExternalLink,
  Search,
  Database,
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  MessageSquare,
  Phone,
  Receipt,
  Wrench,
  Route as RouteIcon,
  UserCheck,
  ShieldAlert,
} from "lucide-react";
import type { UIMessage } from "ai";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Markdown } from "@/components/ki/markdown";
import { Button } from "@/components/ui/button";

interface WebQuelle {
  titel: string;
  url: string;
  auszug: string;
}

// Anzeige-Metadaten für die Geschäftsdaten-Werkzeuge (Quellenangabe & Ladehinweis).
const BUSINESS_TOOLS: Record<string, { label: string; laden: string }> = {
  "tool-transporte_abrufen": { label: "Dispatch", laden: "Liest Transporte/Dispatch …" },
  "tool-fahrer_abrufen": { label: "Fahrer", laden: "Liest Fahrerdaten …" },
  "tool-fahrzeuge_abrufen": { label: "Flotte", laden: "Liest Fahrzeugdaten …" },
  "tool-wartung_abrufen": { label: "Wartung", laden: "Prüft Wartungsbedarf …" },
  "tool-patienten_abrufen": { label: "Patienten", laden: "Liest Patientendaten …" },
  "tool-kunden_abrufen": { label: "Kunden", laden: "Liest Kundendaten …" },
  "tool-finanzen_abrufen": { label: "Buchhaltung", laden: "Liest Finanzkennzahlen …" },
  "tool-kennzahlen_abrufen": { label: "Executive Dashboard", laden: "Berechnet Kennzahlen …" },
  "tool-insights_abrufen": { label: "AI Brain", laden: "Analysiert Optimierungspotenziale …" },
  "tool-prognosen_abrufen": { label: "Prognosen", laden: "Erstellt Prognosen …" },
  "tool-alarme_abrufen": { label: "Alert-Center", laden: "Prüft Warnungen …" },
  "tool-unternehmenssuche": { label: "Enterprise-Suche", laden: "Durchsucht das Unternehmen …" },
};

function matchBusinessTool(type: string) {
  const key = Object.keys(BUSINESS_TOOLS).find((k) => type.startsWith(k));
  return key ? BUSINESS_TOOLS[key] : undefined;
}

function QuellenChips({ quellen }: { quellen: string[] }) {
  if (quellen.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
        <Database className="h-3.5 w-3.5 text-info" /> Quellen
      </span>
      {quellen.map((q) => (
        <span
          key={q}
          className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          {q}
        </span>
      ))}
    </div>
  );
}

interface VorbereiteteAktion {
  vorbereitet?: boolean;
  typ?: string;
  titel?: string;
  empfaenger?: string | null;
  betreff?: string | null;
  inhalt?: string;
  hinweis?: string;
  fehler?: string;
}

const AKTION_META: Record<string, { label: string; icon: typeof Mail }> = {
  rechnung: { label: "Rechnungsentwurf", icon: Receipt },
  email: { label: "E-Mail-Entwurf", icon: Mail },
  sms: { label: "SMS-Entwurf", icon: MessageSquare },
  whatsapp: { label: "WhatsApp-Entwurf", icon: Phone },
  fahrer_zuweisung: { label: "Fahrer-Zuweisung (Entwurf)", icon: UserCheck },
  wartungserinnerung: { label: "Wartungserinnerung (Entwurf)", icon: Wrench },
  dokument: { label: "Dokument (Entwurf)", icon: FileText },
  routenoptimierung: { label: "Routenoptimierung (Entwurf)", icon: RouteIcon },
};

function SmartActionCard({ aktion }: { aktion: VorbereiteteAktion }) {
  const [entschieden, setEntschieden] = useState<"offen" | "freigegeben" | "verworfen">("offen");

  if (aktion.fehler) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{aktion.fehler}</span>
      </div>
    );
  }

  const meta = (aktion.typ && AKTION_META[aktion.typ]) || { label: "Aktionsentwurf", icon: FileText };
  const Icon = meta.icon;

  return (
    <div className="space-y-2.5 rounded-2xl border border-accent/40 bg-accent/5 p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{aktion.titel ?? meta.label}</p>
          <p className="text-[11px] text-muted-foreground">{meta.label}</p>
        </div>
      </div>

      {(aktion.empfaenger || aktion.betreff) && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {aktion.empfaenger && (
            <p>
              <span className="font-medium text-foreground">An: </span>
              {aktion.empfaenger}
            </p>
          )}
          {aktion.betreff && (
            <p>
              <span className="font-medium text-foreground">Betreff: </span>
              {aktion.betreff}
            </p>
          )}
        </div>
      )}

      {aktion.inhalt && (
        <p className="whitespace-pre-wrap rounded-lg bg-background/60 p-2.5 text-xs leading-relaxed">
          {aktion.inhalt}
        </p>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldAlert className="h-3.5 w-3.5 text-warning" />
        Entwurf – wird nicht automatisch ausgeführt oder versendet.
      </p>

      {entschieden === "offen" ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="h-8 flex-1 gap-1.5"
            onClick={() => {
              setEntschieden("freigegeben");
              toast.success("Entwurf freigegeben", {
                description: "Die Maßnahme kann nun manuell ausgeführt werden.",
              });
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Bestätigen
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 flex-1 gap-1.5"
            onClick={() => {
              setEntschieden("verworfen");
              toast("Entwurf verworfen");
            }}
          >
            <XCircle className="h-3.5 w-3.5" /> Verwerfen
          </Button>
        </div>
      ) : (
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            entschieden === "freigegeben" ? "text-success" : "text-muted-foreground",
          )}
        >
          {entschieden === "freigegeben" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {entschieden === "freigegeben" ? "Freigegeben" : "Verworfen"}
        </p>
      )}
    </div>
  );
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
