import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  getVoiceAutoReadDecision,
  getVoiceManualReadDecision,
  invalidateVoicePlayback,
  isCurrentVoicePlayback,
  isVoiceAutoReadAllowed,
  runVoiceAutoReadNavigation,
  runVoiceManualRead,
  shouldRestartVoiceForRateChange,
  isVoiceReadable,
  VOICE_AUTO_READ_SAFE_PREFIXES,
  VOICE_EXCLUDE_SELECTOR,
  VOICE_SENSITIVE_AUTO_READ_PREFIXES,
} from "./voice-reader-policy.ts";

const component = readFileSync(new URL("./voice-reader-dock.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("../layout/app-shell.tsx", import.meta.url), "utf8");

test("GHASI Vorlesefunktion bleibt standardmäßig aus und wird nur sitzungsbezogen aktiviert", () => {
  assert.match(component, /VOICE_ENABLED_KEY/);
  assert.match(component, /readSessionBoolean\(VOICE_ENABLED_KEY\)/);
  assert.match(component, /Automatisches Vorlesen startet erst nach deiner Aktivierung/);
  assert.match(component, /sessionStorage\.setItem/);
});

test("GHASI Vorlesefunktion startet nach Aktivierung genau über den aktivierten Seiten-Effect", () => {
  const toggleStart = component.indexOf("const toggleEnabled = () => {");
  const toggleEnd = component.indexOf("const changeRate", toggleStart);
  assert.notEqual(toggleStart, -1);
  assert.notEqual(toggleEnd, -1);

  const toggleBlock = component.slice(toggleStart, toggleEnd);
  assert.doesNotMatch(toggleBlock, /if \(next\) speakPage\(\)/);
  assert.match(toggleBlock, /if \(!next\) stop\(\)/);
  assert.match(component, /runVoiceAutoReadNavigation\(enabled, pageKey, speakPage/);
  assert.match(component, /window\.setTimeout\(task, delayMs\)/);
});

test("GHASI Vorlesefunktion bleibt lokal und fordert weder Mikrofon noch externe Sprachdienste an", () => {
  assert.doesNotMatch(
    component,
    /getUserMedia|mediaDevices|SpeechRecognition|webkitSpeechRecognition/,
  );
  assert.doesNotMatch(component, /fetch\(|XMLHttpRequest|WebSocket|localStorage/);
  assert.match(component, /sessionStorage/);
  assert.match(component, /SpeechSynthesisUtterance/);
  assert.match(component, /utterance\.lang = "de-DE"/);
});

test("GHASI Vorlesefunktion respektiert explizite Datenschutz- und Sichtbarkeitsgrenzen im DOM", () => {
  assert.match(component, /document\.createTreeWalker\(main, NodeFilter\.SHOW_TEXT\)/);
  assert.match(component, /isVoiceReadable\(parent, main\)/);
  assert.match(VOICE_EXCLUDE_SELECTOR, /\[data-voice-exclude\]/);
  assert.match(VOICE_EXCLUDE_SELECTOR, /\[aria-hidden="true"\]/);
  assert.match(VOICE_EXCLUDE_SELECTOR, /\[hidden\]/);
  assert.match(VOICE_EXCLUDE_SELECTOR, /\[inert\]/);
});

test("Voice-Privacy-Policy blockiert ausgeschlossene oder unsichtbare Vorfahren zur Laufzeit", () => {
  type FakeElement = HTMLElement & {
    __excluded?: boolean;
    __display?: string;
    __visibility?: string;
  };

  const makeElement = (
    parentElement: HTMLElement | null,
    options: { excluded?: boolean; display?: string; visibility?: string } = {},
  ): FakeElement =>
    ({
      parentElement,
      __excluded: options.excluded,
      __display: options.display ?? "block",
      __visibility: options.visibility ?? "visible",
      matches: () => Boolean(options.excluded),
    }) as unknown as FakeElement;

  const readStyle = (element: Element) => {
    const fake = element as FakeElement;
    return { display: fake.__display ?? "block", visibility: fake.__visibility ?? "visible" };
  };

  const boundary = makeElement(null);
  const visibleParent = makeElement(boundary);
  const visibleChild = makeElement(visibleParent);
  assert.equal(isVoiceReadable(visibleChild, boundary, readStyle), true);

  const excludedParent = makeElement(boundary, { excluded: true });
  const excludedChild = makeElement(excludedParent);
  assert.equal(isVoiceReadable(excludedChild, boundary, readStyle), false);

  const hiddenParent = makeElement(boundary, { display: "none" });
  const hiddenChild = makeElement(hiddenParent);
  assert.equal(isVoiceReadable(hiddenChild, boundary, readStyle), false);

  const collapsedParent = makeElement(boundary, { visibility: "collapse" });
  const collapsedChild = makeElement(collapsedParent);
  assert.equal(isVoiceReadable(collapsedChild, boundary, readStyle), false);
});

test("Voice-Sensitive-Surface-Policy sperrt sensible und unbekannte Seiten fail-closed", () => {
  const sensitive = [
    "/",
    "/patienten",
    "/patienten/123",
    "/auftraege",
    "/live-gps",
    "/lohn-laeufe",
    "/rechnungen",
    "/dokumente",
    "/administration",
    "/ki-assistent/thread-1",
    "/einstellungen?tab=firma",
  ];
  for (const path of sensitive) assert.equal(isVoiceAutoReadAllowed(path), false, path);

  const allowed = ["/standorte", "/standorte/details"];
  for (const path of allowed) assert.equal(isVoiceAutoReadAllowed(path), true, path);

  assert.equal(isVoiceAutoReadAllowed("/future-new-route"), false);

  assert.equal(
    new Set(VOICE_SENSITIVE_AUTO_READ_PREFIXES).size,
    VOICE_SENSITIVE_AUTO_READ_PREFIXES.length,
  );
  assert.equal(new Set(VOICE_AUTO_READ_SAFE_PREFIXES).size, VOICE_AUTO_READ_SAFE_PREFIXES.length);
  const sensitivePrefixes = new Set<string>(VOICE_SENSITIVE_AUTO_READ_PREFIXES);
  for (const prefix of VOICE_AUTO_READ_SAFE_PREFIXES) {
    assert.equal(sensitivePrefixes.has(prefix), false, prefix);
  }
});

test("Voice-Sensitive-Surface-Inventar verweist nur auf tatsächlich vorhandene Lovable-Routen", () => {
  const inventoried = [...VOICE_SENSITIVE_AUTO_READ_PREFIXES, ...VOICE_AUTO_READ_SAFE_PREFIXES];
  for (const prefix of inventoried) {
    const routeFile = prefix === "/" ? "index.tsx" : `${prefix.slice(1)}.tsx`;
    assert.equal(
      existsSync(new URL(`../../routes/${routeFile}`, import.meta.url)),
      true,
      `${prefix} -> ${routeFile}`,
    );
  }
});

test("Voice-Navigationsentscheidung bildet safe -> sensibel -> safe deterministisch ab", () => {
  const routeSequence = ["/standorte", "/patienten/123", "/standorte/details"];
  const decisions = routeSequence.map((pageKey) => getVoiceAutoReadDecision(true, pageKey));

  assert.deepEqual(decisions, ["schedule", "stop", "schedule"]);
  assert.equal(getVoiceAutoReadDecision(false, "/standorte"), "inactive");
  assert.equal(getVoiceAutoReadDecision(true, "/future-new-route"), "stop");
});

test("Voice-Navigationsruntime räumt safe -> sensibel -> safe ohne verspätetes Vorlesen auf", () => {
  let speakCount = 0;
  let stopCount = 0;
  let nextTimerId = 1;
  const pending = new Map<number, () => void>();

  const runtime = {
    stop: () => {
      stopCount += 1;
    },
    schedule: (task: () => void, delayMs: number) => {
      assert.equal(delayMs, 150);
      const id = nextTimerId++;
      pending.set(id, task);
      return () => {
        pending.delete(id);
      };
    },
  };

  const speakPage = () => {
    speakCount += 1;
  };

  const cleanupSafe = runVoiceAutoReadNavigation(true, "/standorte", speakPage, runtime);
  assert.equal(pending.size, 1);
  assert.equal(stopCount, 0);
  cleanupSafe();
  assert.equal(pending.size, 0, "der alte Safe-Timer muss vor dem Routenwechsel verschwinden");
  assert.equal(stopCount, 1, "Cleanup muss laufende Sprache der alten Safe-Route beenden");

  const cleanupSensitive = runVoiceAutoReadNavigation(true, "/patienten/123", speakPage, runtime);
  assert.equal(stopCount, 2, "sensible Zielroute stoppt zusätzlich fail-closed");
  assert.equal(pending.size, 0);
  cleanupSensitive();
  assert.equal(stopCount, 3, "auch sensible Route besitzt eine harte Cleanup-Grenze");

  const cleanupSafeAgain = runVoiceAutoReadNavigation(
    true,
    "/standorte/details",
    speakPage,
    runtime,
  );
  assert.equal(pending.size, 1);
  const [task] = pending.values();
  assert.ok(task);
  task();
  assert.equal(speakCount, 1);
  cleanupSafeAgain();
  assert.equal(pending.size, 0);
  assert.equal(stopCount, 4, "auch nach gestarteter neuer Safe-Sprache stoppt Route-Cleanup hart");
});

test("Manuelles Vorlesen verlangt auf sensiblen und unbekannten Seiten eine ausdrückliche Bestätigung", () => {
  assert.equal(getVoiceManualReadDecision("/standorte"), "read");
  assert.equal(getVoiceManualReadDecision("/patienten/123"), "confirm");
  assert.equal(getVoiceManualReadDecision("/future-new-route"), "confirm");

  let speakCount = 0;
  let confirmCount = 0;
  const speakPage = () => {
    speakCount += 1;
  };

  assert.equal(
    runVoiceManualRead("/standorte", speakPage, {
      confirmSensitiveRead: () => {
        confirmCount += 1;
        return false;
      },
    }),
    "spoken",
  );
  assert.equal(confirmCount, 0, "sichere Seite darf ohne Zusatzdialog manuell vorlesen");
  assert.equal(speakCount, 1);

  assert.equal(
    runVoiceManualRead("/patienten/123", speakPage, {
      confirmSensitiveRead: () => {
        confirmCount += 1;
        return false;
      },
    }),
    "cancelled",
  );
  assert.equal(confirmCount, 1);
  assert.equal(speakCount, 1, "abgelehnte Bestätigung darf keine Sprache starten");

  assert.equal(
    runVoiceManualRead("/patienten/123", speakPage, {
      confirmSensitiveRead: () => {
        confirmCount += 1;
        return true;
      },
    }),
    "spoken",
  );
  assert.equal(confirmCount, 2);
  assert.equal(speakCount, 2);
});

test("Sensible manuelle Vorlesefreigabe wird nie für weitere Vorlesevorgänge wiederverwendet", () => {
  let speakCount = 0;
  let confirmCount = 0;
  const confirmations = [true, false, true];

  const runtime = {
    confirmSensitiveRead: () => {
      const decision = confirmations[confirmCount];
      confirmCount += 1;
      return decision ?? false;
    },
  };
  const speakPage = () => {
    speakCount += 1;
  };

  assert.equal(runVoiceManualRead("/patienten/123", speakPage, runtime), "spoken");
  assert.equal(runVoiceManualRead("/patienten/123", speakPage, runtime), "cancelled");
  assert.equal(runVoiceManualRead("/patienten/123", speakPage, runtime), "spoken");

  assert.equal(confirmCount, 3, "jeder sensible Vorlesevorgang braucht eine frische Bestätigung");
  assert.equal(
    speakCount,
    2,
    "abgelehnte Einzelbestätigung darf nicht durch eine frühere Freigabe ersetzt werden",
  );
  assert.doesNotMatch(component, /voice.*confirm.*session|trusted.*voice|remember.*voice/i);
  assert.match(component, /Diese Freigabe gilt nur für diesen Vorlesevorgang/);
  assert.match(component, /muss jedes Mal bestätigt werden/);
});

test("Deaktivierte Voice-Navigation plant nichts, stoppt aber beim Verlassen der Route hart", () => {
  let scheduled = false;
  let stopCount = 0;
  const cleanup = runVoiceAutoReadNavigation(false, "/standorte", () => undefined, {
    stop: () => {
      stopCount += 1;
    },
    schedule: () => {
      scheduled = true;
      return () => undefined;
    },
  });

  assert.equal(scheduled, false);
  assert.equal(stopCount, 0, "auf der aktuellen Route darf Auto-Read-aus nichts abbrechen");
  cleanup();
  assert.equal(stopCount, 1, "beim Verlassen der Route muss auch manuelle Sprache enden");
});

test("Laufendes sensibles manuelles Vorlesen kann keine Routengrenze überschreiten", () => {
  let speaking = false;
  let stopCount = 0;

  const cleanupCurrentRoute = runVoiceAutoReadNavigation(false, "/patienten/123", () => undefined, {
    stop: () => {
      stopCount += 1;
      speaking = false;
    },
    schedule: () => {
      throw new Error("Auto-Read darf bei deaktivierter Voice nicht geplant werden");
    },
  });

  assert.equal(
    runVoiceManualRead(
      "/patienten/123",
      () => {
        speaking = true;
      },
      { confirmSensitiveRead: () => true },
    ),
    "spoken",
  );
  assert.equal(speaking, true);
  assert.equal(stopCount, 0);

  cleanupCurrentRoute();
  assert.equal(speaking, false, "alte sensible Sprache muss vor der neuen Route beendet sein");
  assert.equal(stopCount, 1);
});

test("Verspätete Utterance-Callbacks können neue Queue und neuen State nicht verändern", () => {
  const generation = { current: 0 };
  let queueIndex = 0;
  let state = "idle";

  const oldToken = invalidateVoicePlayback(generation);
  assert.equal(oldToken, 1);
  state = "speaking-old";

  // Ein neuer Vorlesevorgang invalidiert alle Callbacks des alten Utterance.
  const newToken = invalidateVoicePlayback(generation);
  assert.equal(newToken, 2);
  queueIndex = 0;
  state = "speaking-new";

  const oldOnEnd = () => {
    if (!isCurrentVoicePlayback(generation, oldToken)) return;
    queueIndex += 1;
    state = "old-ended";
  };
  const oldOnError = () => {
    if (!isCurrentVoicePlayback(generation, oldToken)) return;
    state = "idle";
  };

  oldOnEnd();
  oldOnError();
  assert.equal(queueIndex, 0, "stales onend darf die neue Queue nicht weiterschalten");
  assert.equal(state, "speaking-new", "stales onerror darf neuen Speech-State nicht zurücksetzen");

  assert.equal(isCurrentVoicePlayback(generation, newToken), true);
  if (isCurrentVoicePlayback(generation, newToken)) queueIndex += 1;
  assert.equal(queueIndex, 1, "nur der aktuelle Utterance darf die Queue weiterschalten");

  invalidateVoicePlayback(generation);
  assert.equal(
    isCurrentVoicePlayback(generation, newToken),
    false,
    "stop invalidiert auch den zuletzt aktiven Token",
  );

  assert.match(component, /playbackGeneration = useRef\(0\)/);
  assert.match(component, /invalidateVoicePlayback\(playbackGeneration\)/);
  assert.match(component, /isCurrentVoicePlayback\(playbackGeneration, generation\)/);

  const stopStart = component.indexOf("const stop = useCallback(() => {");
  const stopEnd = component.indexOf("const speakNext", stopStart);
  const stopBlock = component.slice(stopStart, stopEnd);
  assert.ok(
    stopBlock.indexOf("invalidateVoicePlayback(playbackGeneration)") <
      stopBlock.indexOf("window.speechSynthesis.cancel()"),
    "Playback-Generation muss vor Browser-cancel invalidiert werden",
  );
});

test("Voice Browser-Event-Reihenfolge behandelt Stop und Tempoänderung deterministisch", () => {
  const generation = { current: 0 };
  const firstToken = invalidateVoicePlayback(generation);

  // Mehrfaches Stoppen bleibt fail-closed: Jeder Stop invalidiert ältere Events.
  invalidateVoicePlayback(generation);
  invalidateVoicePlayback(generation);
  assert.equal(isCurrentVoicePlayback(generation, firstToken), false);

  // Laufende Sprache darf für eine sofortige Tempoänderung kontrolliert neu starten.
  assert.equal(shouldRestartVoiceForRateChange("speaking"), true);

  // Eine Pause darf durch die Auswahl einer neuen Rate nicht unbeabsichtigt aufgehoben werden.
  assert.equal(shouldRestartVoiceForRateChange("paused"), false);
  assert.equal(shouldRestartVoiceForRateChange("idle"), false);
  assert.equal(shouldRestartVoiceForRateChange("unsupported"), false);

  const changeRateStart = component.indexOf("const changeRate = (next: VoiceRate) => {");
  const changeRateEnd = component.indexOf("return (", changeRateStart);
  assert.notEqual(changeRateStart, -1);
  assert.notEqual(changeRateEnd, -1);
  const changeRateBlock = component.slice(changeRateStart, changeRateEnd);
  assert.match(changeRateBlock, /shouldRestartVoiceForRateChange\(state\)/);
  assert.doesNotMatch(changeRateBlock, /state === "speaking" \|\| state === "paused"/);
});

test("Automatisches Vorlesen setzt die Navigationsruntime um; manuelles Vorlesen bleibt erhalten", () => {
  assert.match(component, /runVoiceAutoReadNavigation\(enabled, pageKey, speakPage/);
  assert.match(component, /window\.setTimeout\(task, delayMs\)/);
  assert.match(component, /window\.clearTimeout\(timer\)/);
  assert.match(component, /onClick=\{manualReadPage\}/);
  assert.match(component, /runVoiceManualRead\(pageKey, speakPage/);
  assert.match(component, /window\.confirm/);
  assert.match(component, /sensible sichtbare Inhalte/);
  assert.match(component, /Manuelles Vorlesen bleibt möglich/);
});

test("GHASI Vorlesefunktion liest den sichtbaren Hauptinhalt sequenziell und kontrollierbar", () => {
  assert.match(component, /document\.querySelector<HTMLElement>\("main"\)/);
  assert.match(component, /NodeFilter\.SHOW_TEXT/);
  assert.match(component, /splitSpeechText/);
  assert.match(component, /Sprechtempo/);
  assert.match(component, /Langsam/);
  assert.match(component, /Schnell/);
  assert.match(component, /speechSynthesis\.pause/);
  assert.match(component, /speechSynthesis\.resume/);
  assert.match(component, /Stoppen/);
});

test("GHASI Vorlesefunktion ist global im authentifizierten App-Shell eingebunden", () => {
  assert.match(shell, /VoiceReaderDock/);
  assert.match(shell, /pageKey=\{pathname\}/);
});
