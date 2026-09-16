import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Square, Volume2 } from "lucide-react";

import {
  invalidateVoicePlayback,
  isCurrentVoicePlayback,
  isVoiceAutoReadAllowed,
  isVoiceReadable,
  runVoiceAutoReadNavigation,
  runVoiceManualRead,
  shouldRestartVoiceForRateChange,
} from "@/components/voice/voice-reader-policy";

const VOICE_ENABLED_KEY = "ghasi.voice.session.enabled";
const VOICE_RATE_KEY = "ghasi.voice.rate";

type VoiceRate = "slow" | "normal" | "fast";
type VoiceState = "idle" | "speaking" | "paused" | "unsupported";

const rates: Readonly<Record<VoiceRate, number>> = {
  slow: 0.78,
  normal: 0.94,
  fast: 1.18,
};

const rateLabels: Readonly<Record<VoiceRate, string>> = {
  slow: "Langsam",
  normal: "Normal",
  fast: "Schnell",
};

function readSessionBoolean(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function readRate(): VoiceRate {
  if (typeof window === "undefined") return "normal";
  try {
    const value = window.sessionStorage.getItem(VOICE_RATE_KEY);
    return value === "slow" || value === "fast" || value === "normal" ? value : "normal";
  } catch {
    return "normal";
  }
}

function visiblePageText(): string {
  if (typeof document === "undefined" || typeof window === "undefined") return "";
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return "";

  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];

  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    const text = node.textContent?.trim() ?? "";
    if (parent && text && isVoiceReadable(parent, main)) {
      parts.push(text);
    }
    node = walker.nextNode();
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function splitSpeechText(text: string, maxLength = 220): string[] {
  if (text.length <= maxLength) return text ? [text] : [];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLength) {
    const boundary = Math.max(
      rest.lastIndexOf(". ", maxLength),
      rest.lastIndexOf("! ", maxLength),
      rest.lastIndexOf("? ", maxLength),
      rest.lastIndexOf(" ", maxLength),
    );
    const cut = boundary > 40 ? boundary + 1 : maxLength;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function VoiceReaderDock({ pageKey, pageLabel }: { pageKey: string; pageLabel: string }) {
  const [enabled, setEnabled] = useState(false);
  const [rate, setRate] = useState<VoiceRate>("normal");
  const [state, setState] = useState<VoiceState>("idle");
  const [expanded, setExpanded] = useState(false);
  const queue = useRef<string[]>([]);
  const queueIndex = useRef(0);
  const playbackGeneration = useRef(0);
  const activeRate = useRef<VoiceRate>(rate);
  const autoReadAllowed = isVoiceAutoReadAllowed(pageKey);

  const supported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof SpeechSynthesisUtterance !== "undefined";

  const persist = useCallback((key: string, value: string) => {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Die Sprachfunktion bleibt auch ohne Sitzungs-Speicher nutzbar.
    }
  }, []);

  const stop = useCallback(() => {
    invalidateVoicePlayback(playbackGeneration);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    queue.current = [];
    queueIndex.current = 0;
    setState("idle");
  }, []);

  const speakNext = useCallback(
    (generation: number) => {
      if (!isCurrentVoicePlayback(playbackGeneration, generation)) return;
      if (!supported || typeof window === "undefined") {
        setState("unsupported");
        return;
      }
      const text = queue.current[queueIndex.current];
      if (!text) {
        setState("idle");
        return;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "de-DE";
      utterance.rate = rates[activeRate.current];
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onstart = () => {
        if (isCurrentVoicePlayback(playbackGeneration, generation)) setState("speaking");
      };
      utterance.onend = () => {
        if (!isCurrentVoicePlayback(playbackGeneration, generation)) return;
        queueIndex.current += 1;
        speakNext(generation);
      };
      utterance.onerror = () => {
        if (isCurrentVoicePlayback(playbackGeneration, generation)) setState("idle");
      };
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  const speakPage = useCallback(() => {
    const text = visiblePageText();
    if (!text) return;
    if (!supported) {
      setState("unsupported");
      return;
    }
    stop();
    const generation = playbackGeneration.current;
    queue.current = splitSpeechText(text);
    queueIndex.current = 0;
    speakNext(generation);
  }, [speakNext, stop, supported]);

  const manualReadPage = useCallback(
    () =>
      runVoiceManualRead(pageKey, speakPage, {
        confirmSensitiveRead: () =>
          window.confirm(
            "Diese Seite kann sensible sichtbare Inhalte enthalten. Möchtest du die sichtbaren Inhalte wirklich vorlesen lassen? Diese Freigabe gilt nur für diesen Vorlesevorgang.",
          ),
      }),
    [pageKey, speakPage],
  );

  useEffect(
    () =>
      runVoiceAutoReadNavigation(enabled, pageKey, speakPage, {
        stop,
        schedule: (task, delayMs) => {
          const timer = window.setTimeout(task, delayMs);
          return () => window.clearTimeout(timer);
        },
      }),
    [enabled, pageKey, speakPage, stop],
  );

  useEffect(() => {
    setEnabled(readSessionBoolean(VOICE_ENABLED_KEY));
    setRate(readRate());
  }, []);

  useEffect(() => {
    activeRate.current = rate;
  }, [rate]);

  useEffect(() => stop, [stop]);

  const toggleEnabled = () => {
    const next = !enabled;
    setEnabled(next);
    persist(VOICE_ENABLED_KEY, String(next));
    if (!next) stop();
  };

  const changeRate = (next: VoiceRate) => {
    setRate(next);
    activeRate.current = next;
    persist(VOICE_RATE_KEY, next);
    if (shouldRestartVoiceForRateChange(state)) speakPage();
  };

  return (
    <aside
      className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border/70 bg-card/95 p-3 shadow-elevated backdrop-blur"
      aria-label="GHASI Vorlesefunktion"
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <Volume2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">GHASI vorlesen</span>
          <span className="block truncate text-xs text-muted-foreground">{pageLabel}</span>
        </span>
        <span className="text-xs text-muted-foreground">{expanded ? "×" : "⌃"}</span>
      </button>

      {expanded && (
        <div className="mt-3 grid gap-2 border-t border-border/70 pt-3">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!supported}
            aria-pressed={enabled}
            onClick={toggleEnabled}
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            {enabled ? "Automatisches Vorlesen aktiv" : "Vorlesen aktivieren"}
          </button>

          <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Sprechtempo</span>
            <select
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              value={rate}
              aria-label="Sprechtempo"
              onChange={(event) => changeRate(event.target.value as VoiceRate)}
            >
              {(Object.keys(rates) as VoiceRate[]).map((key) => (
                <option key={key} value={key}>
                  {rateLabels[key]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!supported || state === "speaking" || state === "paused"}
              onClick={manualReadPage}
            >
              <Play className="h-4 w-4" aria-hidden="true" /> Seite vorlesen
            </button>
            {state === "speaking" && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                onClick={() => {
                  window.speechSynthesis.pause();
                  setState("paused");
                }}
              >
                <Pause className="h-4 w-4" aria-hidden="true" /> Pause
              </button>
            )}
            {state === "paused" && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                onClick={() => {
                  window.speechSynthesis.resume();
                  setState("speaking");
                }}
              >
                <Play className="h-4 w-4" aria-hidden="true" /> Fortsetzen
              </button>
            )}
            {(state === "speaking" || state === "paused") && (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-1 rounded-xl border border-destructive/50 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                onClick={stop}
              >
                <Square className="h-4 w-4" aria-hidden="true" /> Stoppen
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground" role="status">
            {!supported
              ? "Die Browser-Sprachausgabe ist auf diesem Gerät nicht verfügbar."
              : state === "paused"
                ? "Vorlesen pausiert."
                : enabled && !autoReadAllowed
                  ? "Automatisches Vorlesen ist auf dieser sensiblen Seite gesperrt. Manuelles Vorlesen bleibt möglich und muss jedes Mal bestätigt werden."
                  : enabled
                    ? `Neue Seiten werden automatisch vorgelesen · ${rateLabels[rate]}.`
                    : "Automatisches Vorlesen startet erst nach deiner Aktivierung."}
          </p>
        </div>
      )}
    </aside>
  );
}
