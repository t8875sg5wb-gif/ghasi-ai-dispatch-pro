export const VOICE_EXCLUDE_SELECTOR =
  '[data-voice-exclude], [aria-hidden="true"], [hidden], [inert], script, style, noscript, template';

/**
 * Seiten mit personenbezogenen, Gesundheits-, Personal-, Finanz-, Standort-,
 * Kommunikations- oder Administrationsdaten werden nie automatisch vorgelesen.
 * Nach ausdrücklicher Sitzungsaktivierung bleibt "Seite vorlesen" dort manuell möglich.
 */
export const VOICE_SENSITIVE_AUTO_READ_PREFIXES = [
  "/",
  "/aktions-center",
  "/aktivitaeten",
  "/administration",
  "/auftraege",
  "/ausgaben",
  "/automatisierung",
  "/berichte",
  "/beschaeftigungsverhaeltnisse",
  "/buchhaltung",
  "/ceo-cockpit",
  "/compliance",
  "/control-center",
  "/datenabgleich",
  "/datenimport",
  "/dauerauftraege",
  "/dialysezentren",
  "/dokumente",
  "/einrichtungen",
  "/einstellungen",
  "/euer",
  "/fahrer",
  "/fahrer-mobil",
  "/fahrtenbuch",
  "/fahrzeuge",
  "/insights",
  "/jahresabschluss",
  "/kassenvertraege",
  "/ki-assistent",
  "/krankenhaeuser",
  "/kunden",
  "/leasing",
  "/live-gps",
  "/lohn",
  "/lohn-fakten",
  "/lohn-laeufe",
  "/lohn-regelwerke",
  "/patienten",
  "/pflegeheime",
  "/posteingang",
  "/prognosen",
  "/rechnungen",
  "/schichtplan",
  "/statistiken",
  "/telefon",
  "/tourenplanung",
  "/versicherungen",
  "/verbindungen",
  "/warnungen",
  "/wartung",
] as const;

/**
 * Automatisches Vorlesen ist fail-closed: Nur ausdrücklich inventarisierte
 * unkritische Seiten dürfen nach Sitzungsaktivierung automatisch starten.
 * Neue/unbekannte Routen bleiben bis zur Prüfung manuell-only.
 */
export const VOICE_AUTO_READ_SAFE_PREFIXES = ["/standorte"] as const;

type VoiceStyle = Pick<CSSStyleDeclaration, "display" | "visibility">;
type VoiceStyleReader = (element: Element) => VoiceStyle;

export type VoicePlaybackGeneration = { current: number };

export type VoicePlaybackState = "idle" | "speaking" | "paused" | "unsupported";

/**
 * Eine Tempoänderung startet nur laufende Sprache kontrolliert neu. Im Pause-
 * Zustand bleibt die aktuelle Wiedergabe pausiert; die neue Rate gilt für den
 * nächsten gesprochenen Abschnitt bzw. den nächsten expliziten Start.
 */
export function shouldRestartVoiceForRateChange(state: VoicePlaybackState): boolean {
  return state === "speaking";
}

/**
 * Invalidiert atomar alle Callback-Token älterer SpeechSynthesis-Utterances.
 * Browser dürfen nach cancel() noch verspätete Events liefern; diese Generation
 * stellt sicher, dass solche Events weder Queue noch UI-State verändern.
 */
export function invalidateVoicePlayback(generation: VoicePlaybackGeneration): number {
  generation.current += 1;
  return generation.current;
}

export function isCurrentVoicePlayback(
  generation: VoicePlaybackGeneration,
  token: number,
): boolean {
  return generation.current === token;
}

export function isVoiceAutoReadAllowed(pageKey: string): boolean {
  const pathname = pageKey.split(/[?#]/, 1)[0] || "/";
  return VOICE_AUTO_READ_SAFE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export type VoiceManualReadDecision = "read" | "confirm";

export function getVoiceManualReadDecision(pageKey: string): VoiceManualReadDecision {
  return isVoiceAutoReadAllowed(pageKey) ? "read" : "confirm";
}

type VoiceManualReadRuntime = {
  confirmSensitiveRead: () => boolean;
};

/**
 * Manuelles vollständiges Vorlesen bleibt möglich, benötigt auf sensiblen oder
 * unbekannten Seiten aber eine ausdrückliche Bestätigung direkt vor dem Start.
 */
export function runVoiceManualRead(
  pageKey: string,
  speakPage: () => void,
  runtime: VoiceManualReadRuntime,
): "spoken" | "cancelled" {
  if (getVoiceManualReadDecision(pageKey) === "confirm" && !runtime.confirmSensitiveRead()) {
    return "cancelled";
  }
  speakPage();
  return "spoken";
}

export type VoiceAutoReadDecision = "inactive" | "stop" | "schedule";

/**
 * Deterministische Navigationsentscheidung für das automatische Vorlesen.
 * Sie enthält keine Browser-, Netzwerk- oder Datenbankoperationen und wird von
 * der React-Shell lediglich in Stop bzw. verzögertes Vorlesen umgesetzt.
 */
export function getVoiceAutoReadDecision(enabled: boolean, pageKey: string): VoiceAutoReadDecision {
  if (!enabled) return "inactive";
  return isVoiceAutoReadAllowed(pageKey) ? "schedule" : "stop";
}

type VoiceAutoReadRuntime = {
  schedule: (task: () => void, delayMs: number) => () => void;
  stop: () => void;
};

/**
 * Führt genau eine Navigationsentscheidung aus. Der Aufrufer besitzt den Timer
 * und ruft die zurückgegebene Cleanup-Funktion vor dem nächsten Seiten-Effect auf.
 */
export function runVoiceAutoReadNavigation(
  enabled: boolean,
  pageKey: string,
  speakPage: () => void,
  runtime: VoiceAutoReadRuntime,
): () => void {
  const decision = getVoiceAutoReadDecision(enabled, pageKey);
  let cancelScheduledRead: () => void = () => undefined;

  if (decision === "stop") {
    runtime.stop();
  } else if (decision === "schedule") {
    cancelScheduledRead = runtime.schedule(speakPage, 150);
  }

  // Die Effect-Cleanup ist zugleich die harte Seitengrenze: Auch manuell
  // gestartete oder bereits laufende Sprache darf die alte Route nie verlassen.
  return () => {
    cancelScheduledRead();
    runtime.stop();
  };
}

export function isVoiceReadable(
  element: HTMLElement,
  boundary: HTMLElement,
  getStyle: VoiceStyleReader = (candidate) => window.getComputedStyle(candidate),
): boolean {
  let current: HTMLElement | null = element;
  while (current) {
    if (current.matches(VOICE_EXCLUDE_SELECTOR)) return false;

    const style = getStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    ) {
      return false;
    }

    if (current === boundary) break;
    current = current.parentElement;
  }
  return true;
}
