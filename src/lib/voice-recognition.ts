export interface SpeechResultAlternativeLike {
  transcript: string;
}

export interface SpeechResultLike extends ArrayLike<SpeechResultAlternativeLike> {
  isFinal: boolean;
}

export interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechResultLike>;
}

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
export function resolveSpeechRecognitionConstructor(source: {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}): SpeechRecognitionConstructor | null {
  return source.SpeechRecognition ?? source.webkitSpeechRecognition ?? null;
}

export function transcriptFromSpeechResults(results: ArrayLike<SpeechResultLike>): string {
  let finalText = "";
  let interimText = "";
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const text = result?.[0]?.transcript ?? "";
    if (result?.isFinal) finalText += text;
    else interimText += text;
  }
  return `${finalText}${interimText}`.trim();
}

export const VOICE_PRIVACY_NOTICE_KEY = "ghasi:voice:privacy-notice:v1";
