import type { AppRole } from "@/lib/roles";

export const EXTERNAL_AI_ALLOWED_BUSINESS_TOOLS = [
  "kennzahlen_abrufen",
  "prognosen_abrufen",
  "aktion_vorbereiten",
] as const;

const ERLAUBT = new Set<string>(EXTERNAL_AI_ALLOWED_BUSINESS_TOOLS);

export function filterExternalAiBusinessTools<T extends Record<string, unknown>>(
  tools: T,
  businessDataAvailable = true,
) {
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) =>
      businessDataAvailable ? ERLAUBT.has(name) : name === "aktion_vorbereiten",
    ),
  );
}

function norm(text: string): string {
  return text.normalize("NFKC").trim().toLocaleLowerCase("de-DE");
}

export function containsKnownPersonName(text: string, names: string[]): boolean {
  const hay = norm(text);
  return names.some((name) => {
    const needle = norm(name);
    return needle.length >= 3 && hay.includes(needle);
  });
}
const EXTERNE_KI_SENSIBEL: RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\bDE\d{2}(?:[ ]?\d{4}){4}[ ]?\d{2}\b/i,
  /\b(?:\+49|0)\s?\d{2,5}[\s/.-]?\d{3,}(?:[\s.-]?\d+)*\b/,
  /\b[\p{L}.-]+(?:straße|str\.|weg|allee|platz|gasse|ring)\s+\d+[a-z]?\b/iu,
  /\b(patient(?:in)?|diagnose|medikament|krankheitsbild|geburtsdatum|versichertennummer)\b/i,
  /\b(auftrag(?:snummer)?|rechnungsnummer|personalnummer)\s*[:#-]?\s*[A-Z0-9/-]{3,}\b/i,
];

export function containsPotentialSensitiveData(text: string): boolean {
  return EXTERNE_KI_SENSIBEL.some((muster) => muster.test(text));
}

export function buildExternalAiSnapshot(
  role: AppRole | null,
  businessDataAvailable = true,
): string {
  const rollenHinweis = role ?? "keine Rolle";
  return [
    "# Externe-KI-Datengrenze",
    `Rolle: ${rollenHinweis}.`,
    businessDataAvailable
      ? "Aggregierte Betriebskennzahlen sind über den serverseitigen GHASI-Datenpfad verfügbar."
      : "Aggregierte Betriebskennzahlen sind in dieser Serverumgebung nicht konfiguriert; keine KPI-Werte raten oder aus alten Mirrors ableiten.",
    "Dieser externe KI-Provider erhält standardmäßig keine Patienten-, Fahrer-, GPS-, Rechnungs-, Dokument- oder sonstigen personenbezogenen Rohdaten.",
    "Verwende nur die bereitgestellten aggregierten Werkzeuge. Fehlen Detaildaten, sage ausdrücklich, dass sie aus Datenschutzgründen nur in den internen GHASI-Fachmodulen verfügbar sind.",
    "Keine internen Namen, Adressen, medizinischen Angaben oder Identifikatoren an Web-Suche oder andere externe Werkzeuge weitergeben.",
    "Langzeitgedächtnis und interne proaktive Hinweise werden diesem externen Provider nicht automatisch bereitgestellt.",
  ].join("\n");
}
