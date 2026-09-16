import { describe, expect, test } from "bun:test";
import {
  resolveSpeechRecognitionConstructor,
  transcriptFromSpeechResults,
  type SpeechRecognitionLike,
} from "@/lib/voice-recognition";

class StandardRecognition implements SpeechRecognitionLike {
  lang = "";
  interimResults = false;
  continuous = false;
  onresult = null;
  onend = null;
  onerror = null;
  start() {}
  stop() {}
}

class WebkitRecognition extends StandardRecognition {}

describe("Voice-Erkennung", () => {
  test("bevorzugt die Standard-SpeechRecognition-API", () => {
    const result = resolveSpeechRecognitionConstructor({
      SpeechRecognition: StandardRecognition,
      webkitSpeechRecognition: WebkitRecognition,
    });
    expect(result).toBe(StandardRecognition);
  });

  test("nutzt webkitSpeechRecognition als kompatiblen Fallback", () => {
    const result = resolveSpeechRecognitionConstructor({
      webkitSpeechRecognition: WebkitRecognition,
    });
    expect(result).toBe(WebkitRecognition);
  });

  test("liefert null wenn der Browser keine Variante anbietet", () => {
    expect(resolveSpeechRecognitionConstructor({})).toBeNull();
  });

  test("führt finale und vorläufige Transkripte ohne Doppelung zusammen", () => {
    const finalResult = Object.assign([{ transcript: "Guten " }], { isFinal: true });
    const interimResult = Object.assign([{ transcript: "Morgen" }], { isFinal: false });
    expect(transcriptFromSpeechResults([finalResult, interimResult])).toBe("Guten Morgen");
  });
});
