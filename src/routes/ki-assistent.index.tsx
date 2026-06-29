import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bot, Building2, Globe, Paperclip, BrainCircuit, ShieldCheck } from "lucide-react";

import { ChatComposer, type Attachment } from "@/components/ki/chat-composer";
import { useThreadMutations } from "@/hooks/use-threads";
import { setPending } from "@/lib/chat-pending";

export const Route = createFileRoute("/ki-assistent/")({
  component: AssistantStart,
});

const faehigkeiten = [
  {
    icon: Building2,
    titel: "Geschäftsführung",
    text: "Disposition, beste Fahrer & Fahrzeuge, Kosten, Gewinn, Risiken – datenbasiert.",
  },
  {
    icon: Globe,
    titel: "Echtzeit-Internet",
    text: "News, Wetter, Verkehr, Börse, Spritpreise & mehr – mit Quellenangabe.",
  },
  {
    icon: Paperclip,
    titel: "Dateien & Sprache",
    text: "Bilder und PDFs analysieren, per Mikrofon diktieren, Texte & E-Mails entwerfen.",
  },
  {
    icon: BrainCircuit,
    titel: "Langzeitgedächtnis",
    text: "Merkt sich Entscheidungen, Vorlieben und Abläufe – und lernt dazu.",
  },
];

function AssistantStart() {
  const { create } = useThreadMutations();
  const navigate = useNavigate();

  const start = async (text: string, files: Attachment[]) => {
    const t = await create.mutateAsync(text ? text.slice(0, 60) : undefined);
    setPending(t.id, { text, files });
    navigate({ to: "/ki-assistent/$threadId", params: { threadId: t.id } });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="bg-gradient-primary mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl shadow-glow">
            <Bot className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Guten Tag, ich bin GHASI AI</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Ihr digitaler Geschäftsführer und persönlicher KI-Assistent. Fragen Sie mich alles – zum
            Betrieb oder ganz alltäglich. Wichtige Aktionen führe ich nie eigenmächtig aus.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {faehigkeiten.map((f) => (
              <div
                key={f.titel}
                className="flex items-start gap-3 rounded-2xl border border-border/60 bg-muted/30 p-4 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{f.titel}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{f.text}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Nur Empfehlungen – jede verbindliche Aktion bestätigen Sie selbst.
          </p>
        </div>
      </div>

      <ChatComposer onSend={start} busy={create.isPending} />
    </div>
  );
}
