// Client-Typen für die Dauerauftrags-API, abgeleitet aus dem OpenAPI-Schema
// (docs/openapi-dauerauftraege.yaml). Die generierte Datei
// `dauerauftraege-api.gen.ts` wird per `bun run gen:api-types` neu erzeugt und
// darf nicht manuell bearbeitet werden.
//
// Dieses Modul gibt den generierten Typen sprechende Namen und typisiert
// insbesondere den Fehler-Typ von `createRecurring` und `updateRecurring`.
import {
  DAUERAUFTRAG_FELD_LABEL,
  dekodiereFeldFehler,
  feldFehlerMap,
  lesbarerFehlerText,
} from "@/lib/recurring-validation";
import type { FeldFehler as InternerFeldFehler } from "@/lib/recurring-validation";

import type { components, operations } from "./dauerauftraege-api.gen";

type Schemas = components["schemas"];

/** Marker, hinter dem die Feldfehlerliste in `error.message` kodiert ist. */
export const FELDFEHLER_MARKER = "__GHASI_FELDFEHLER__";

/** Ein einzelner Feldfehler: `{ path, label, message }`. */
export type ApiFeldFehler = Schemas["FeldFehler"];
/** JSON-Teil hinter dem Marker: `{ fields: [...] }`. */
export type ApiFeldFehlerListe = Schemas["FeldFehlerListe"];
/** Fehlerobjekt des RPC-Transports mit kodierter Feldfehlerliste. */
export type ApiFeldFehlerAntwort = Schemas["FeldFehlerKodierung"];
/** Fehler ohne Feldliste (fachlich/technisch, z. B. „Patient nicht gefunden.“). */
export type ApiServerFehler = { message: string };

/** Eingabefelder eines Dauerauftrags (strenges Schema). */
export type ApiRecurringFields = Schemas["RecurringFields"];
export type ApiCreateRecurringRequest = Schemas["CreateRecurringRequest"];
export type ApiUpdateRecurringRequest = Schemas["UpdateRecurringRequest"];
export type ApiDauerauftrag = Schemas["Dauerauftrag"];

/** Antworttypen der beiden Operationen (Erfolg + Fehler). */
export type CreateRecurringErgebnis =
  operations["createRecurring"]["responses"]["200"]["content"]["application/json"];
export type UpdateRecurringErgebnis =
  operations["updateRecurring"]["responses"]["200"]["content"]["application/json"];

/** Vereinheitlichter Fehler-Typ der beiden Mutationen. */
export type RecurringApiFehler =
  | { art: "feldfehler"; text: string; fields: ApiFeldFehler[]; nachPfad: Record<string, string> }
  | { art: "fachlich"; text: string };

/** Prüft, ob eine Fehlermeldung die kodierte Feldfehlerliste enthält. */
export function istFeldFehlerAntwort(fehler: unknown): fehler is ApiFeldFehlerAntwort {
  return (
    typeof fehler === "object" &&
    fehler !== null &&
    typeof (fehler as { message?: unknown }).message === "string" &&
    (fehler as { message: string }).message.includes(FELDFEHLER_MARKER)
  );
}

/**
 * Wandelt einen beliebigen Fehler aus `createRecurring`/`updateRecurring` in
 * den typisierten Fehler-Typ um. Field-Paths kommen immer ohne `values.`-Präfix.
 */
export function parseRecurringFehler(fehler: unknown): RecurringApiFehler {
  const message =
    typeof fehler === "object" && fehler !== null && "message" in fehler
      ? String((fehler as { message: unknown }).message)
      : String(fehler);

  const fields = dekodiereFeldFehler(message) as ApiFeldFehler[];
  const text = lesbarerFehlerText(message);
  if (fields.length === 0) return { art: "fachlich", text };
  return { art: "feldfehler", text, fields, nachPfad: feldFehlerMap(fields) };
}

/** Deutsches Anzeige-Label zu einem Field-Path (Fallback: der Pfad selbst). */
export function apiFeldLabel(path: string): string {
  return DAUERAUFTRAG_FELD_LABEL[path] ?? path;
}

// Sicherheitsnetz: generierter Typ und interner Validierungstyp müssen
// strukturell identisch bleiben. Weicht das Schema ab, schlägt der Typecheck an.
type Gleich<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _feldFehlerTypenStimmenUeberein: Gleich<ApiFeldFehler, InternerFeldFehler> = true;
void _feldFehlerTypenStimmenUeberein;
