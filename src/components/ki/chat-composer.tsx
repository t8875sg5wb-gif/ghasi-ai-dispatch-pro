import { useEffect, useRef, useState } from "react";
import { Send, Paperclip, Mic, X, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { attemptChatSend } from "@/lib/chat-send";
import {
  resolveSpeechRecognitionConstructor,
  transcriptFromSpeechResults,
  VOICE_PRIVACY_NOTICE_KEY,
  type SpeechRecognitionLike,
  type SpeechRecognitionConstructor,
} from "@/lib/voice-recognition";

export interface Attachment {
  type: "file";
  mediaType: string;
  url: string; // data-URL
  filename: string;
}

interface ComposerProps {
  onSend: (text: string, files: Attachment[]) => void | Promise<void>;
  busy: boolean;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ChatComposer({ onSend, busy }: ComposerProps) {
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const submit = async () => {
    const text = input.trim();
    if ((!text && files.length === 0) || busy) return;
    const result = await attemptChatSend(onSend, text, files);
    if (result.ok) {
      setInput("");
      setFiles([]);
    } else {
      toast.error("Nachricht konnte nicht gesendet werden.", {
        description: result.error ?? "Der Entwurf bleibt erhalten. Bitte erneut versuchen.",
      });
    }
    requestAnimationFrame(() => textRef.current?.focus());
  };

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setReading(true);
    try {
      const next: Attachment[] = [];
      for (const f of Array.from(list).slice(0, 5)) {
        if (f.size > 15 * 1024 * 1024) {
          toast.error(`${f.name} ist größer als 15 MB.`);
          continue;
        }
        next.push({
          type: "file",
          mediaType: f.type || "application/octet-stream",
          url: await fileToDataUrl(f),
          filename: f.name,
        });
      }
      setFiles((prev) => [...prev, ...next].slice(0, 5));
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const toggleVoice = () => {
    const source = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SR = resolveSpeechRecognitionConstructor(source);
    if (!SR) {
      toast.error("Spracheingabe wird von diesem Browser nicht unterstützt.");
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    let privacyAccepted = false;
    try {
      privacyAccepted = window.sessionStorage.getItem(VOICE_PRIVACY_NOTICE_KEY) === "accepted";
    } catch {
      privacyAccepted = false;
    }
    if (!privacyAccepted) {
      const accepted = window.confirm(
        "Browser-Spracherkennung kann Audio beim Browser-Anbieter verarbeiten. Keine Patienten-, Gesundheits-, Bank- oder Zugangsdaten diktieren. Spracheingabe trotzdem starten?",
      );
      if (!accepted) return;
      try {
        window.sessionStorage.setItem(VOICE_PRIVACY_NOTICE_KEY, "accepted");
      } catch {
        // Sitzungsspeicher kann durch Browserrichtlinien blockiert sein.
      }
    }
    const rec = new SR();
    rec.lang = "de-DE";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (event) => {
      setInput(transcriptFromSpeechResults(event.results));
    };
    rec.onend = () => setRecording(false);
    rec.onerror = () => {
      setRecording(false);
      toast.error("Spracheingabe abgebrochen.");
    };
    recognitionRef.current = rec;
    rec.start();
    setRecording(true);
  };

  return (
    <div className="border-t border-border/70 p-3 sm:p-4">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 py-1.5 pl-2 pr-1.5 text-xs font-medium"
            >
              {f.mediaType.startsWith("image/") ? (
                <img src={f.url} alt="" className="h-6 w-6 rounded object-cover" />
              ) : (
                <FileText className="h-4 w-4 text-primary" />
              )}
              <span className="max-w-32 truncate">{f.filename}</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="rounded-full p-0.5 hover:bg-muted"
                aria-label="Entfernen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-11 w-11 shrink-0 rounded-2xl"
          onClick={() => fileRef.current?.click()}
          disabled={busy || reading}
          aria-label="Datei anhängen"
        >
          {reading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Paperclip className="h-5 w-5" />
          )}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(
            "h-11 w-11 shrink-0 rounded-2xl",
            recording && "bg-destructive/15 text-destructive",
          )}
          onClick={toggleVoice}
          disabled={busy}
          aria-label="Spracheingabe"
        >
          <Mic className={cn("h-5 w-5", recording && "animate-pulse")} />
        </Button>
        <Textarea
          ref={textRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={
            recording
              ? "Sprechen Sie …"
              : "Fragen Sie GHASI AI – alles Geschäftliche oder Alltägliche …"
          }
          rows={1}
          className="max-h-36 min-h-11 flex-1 resize-none rounded-2xl"
        />
        <Button
          onClick={() => void submit()}
          disabled={(!input.trim() && files.length === 0) || busy}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-2xl"
          aria-label="Senden"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
