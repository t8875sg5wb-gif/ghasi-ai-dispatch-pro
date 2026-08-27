# Strukturiertes Fehlerformat: `createRecurring` / `updateRecurring`

Gilt für die Serverfunktionen in `src/lib/recurring.functions.ts`
(`createRecurring`, `updateRecurring`, zusätzlich `deleteRecurring`).
Ziel: Client-Entwickler können Feldfehler direkt am Formularfeld anzeigen.

## 1. Grundprinzip

Validierungsfehler werden **nicht** als freier Text geworfen. Die Serverfunktion
wirft einen `Error`, dessen `message` zwei Teile enthält:

```
<lesbarer Text><MARKER><JSON>
```

- `<lesbarer Text>` – z. B. `Ungültige Dauerauftragsdaten. Patientenname: Bitte den Namen des Patienten angeben.`
- `<MARKER>` – die Konstante `__GHASI_FELDFEHLER__`
- `<JSON>` – `{"fields":[ ... ]}` mit der strukturierten Feldliste

Grund für die Kodierung: über den TanStack-Start-RPC-Transport überlebt nur
`error.message`, keine zusätzlichen Fehlereigenschaften.

## 2. Feldfehler-Objekt

```ts
type FeldFehler = {
  path: string;    // Punkt-Pfad, z. B. "pickup.postalCode", "wochentage"
  label: string;   // deutsches Anzeige-Label, z. B. "Pickup – PLZ"
  message: string; // verständliche Meldung für Endnutzer
};
```

Regeln:

- `path` ist immer **ohne** `values.`-Präfix, auch bei `updateRecurring`
  (aus `{ id, values: { ... } }` wird `patient`, nicht `values.patient`).
- Pro `path` erscheint höchstens ein Eintrag (erster Fehler gewinnt).
- Ist kein Pfad ermittelbar, lautet `path` `"formular"`.
- `label` stammt aus `DAUERAUFTRAG_FELD_LABEL` (`src/lib/recurring-validation.ts`)
  und fällt notfalls auf `path` zurück.

## 3. Beispiel

Aufruf:

```ts
await createRecurring({
  data: { patient: "", terminzeit: "08:00", rhythmus: "woechentlich", wochentage: [] },
});
```

Geworfene `error.message`:

```
Ungültige Dauerauftragsdaten. Patientenname: Bitte den Namen des Patienten angeben. | Wochentage: Bei wöchentlichem Rhythmus mindestens einen Wochentag wählen.__GHASI_FELDFEHLER__{"fields":[{"path":"patient","label":"Patientenname","message":"Bitte den Namen des Patienten angeben."},{"path":"wochentage","label":"Wochentage","message":"Bei wöchentlichem Rhythmus mindestens einen Wochentag wählen."}]}
```

Dekodierter JSON-Teil:

```json
{
  "fields": [
    { "path": "patient", "label": "Patientenname", "message": "Bitte den Namen des Patienten angeben." },
    { "path": "wochentage", "label": "Wochentage", "message": "Bei wöchentlichem Rhythmus mindestens einen Wochentag wählen." }
  ]
}
```

## 4. Client-Auswertung (empfohlenes Muster)

```ts
import {
  dekodiereFeldFehler,
  feldFehlerMap,
  lesbarerFehlerText,
} from "@/lib/recurring-validation";

try {
  await createRecurring({ data: werte });
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  const fields = dekodiereFeldFehler(msg);        // FeldFehler[]
  setFeldFehler(feldFehlerMap(fields));           // { [path]: message }
  toast.error(lesbarerFehlerText(msg));           // Text ohne Marker
}
```

- `dekodiereFeldFehler` gibt `[]` zurück, wenn es kein Validierungsfehler ist
  (z. B. Netz-/Datenbankfehler) – dann nur den Toast anzeigen.
- `feldFehlerMap` liefert eine Map `path -> message` für die Feldanzeige.
- `lesbarerFehlerText` entfernt Marker und JSON aus der Meldung.

Diese Helfer sind client-sicher (keine Serverimporte) und werden bereits in
`src/routes/dauerauftraege.tsx` verwendet.

## 5. Feldpfade

Die vollständige Pfad→Label-Tabelle steht in
`DAUERAUFTRAG_FELD_LABEL` (`src/lib/recurring-validation.ts`). Häufige Pfade:

| Pfad | Label |
| --- | --- |
| `patient` | Patientenname |
| `patientId` | Patient (Stammdaten) |
| `insurerId` | Krankenkasse (Verknüpfung) |
| `pickup` / `pickup.street` / `pickup.postalCode` / `pickup.city` | Pickup-Adresse und Teilfelder |
| `destination` / `destination.street` / `destination.postalCode` / `destination.city` | Destination-Adresse und Teilfelder |
| `terminzeit` | Uhrzeit Hinfahrt |
| `rueckfahrtzeit` | Uhrzeit Rückfahrt |
| `mobilitaet` | Mobilität |
| `rhythmus` | Rhythmus |
| `wochentage` | Wochentage |
| `startDatum` / `endDatum` | Startdatum / Enddatum |
| `pauseVon` / `pauseBis` | Pause von / Pause bis |
| `id` | Datensatz-ID |
| `values` | Änderungen (z. B. „Keine Änderungen übergeben.“) |

## 6. Fehlerquellen

1. **Schema (`.strict()`)** – falscher Typ, unbekanntes Feld, Formatregeln
   (`startDatum` als `YYYY-MM-DD`, `terminzeit`/`rueckfahrtzeit` als `HH:mm`,
   UUID-Felder, Längenbegrenzungen).
2. **Fachliche Querregeln** (`pruefeDauerauftragRegeln`) – z. B. Pflichtadressen,
   Wochentage bei wöchentlichem Rhythmus, Rückfahrtzeit bei aktiver Rückfahrt,
   Enddatum vor Startdatum, unvollständige oder verdrehte Pausenangaben.
   Bei `updateRecurring` laufen die Pflichtfeldprüfungen nur für Felder, die im
   Patch tatsächlich enthalten sind.
3. **Identitätsprüfungen** – existieren `patientId`, `insurerId`,
   `bevorzugterFahrerId` oder `bevorzugtesFahrzeugId` nicht, wirft der Handler
   eine reguläre Fehlermeldung **ohne** Feldliste.

## 7. Protokollierung

Jede abgelehnte Mutation wird serverseitig in `recurring_rejections` mit
Zeitpunkt, Aktion, Grund und der Feldliste protokolliert (Lesezugriff nur für
Admins, sichtbar unter `/dauerauftrag-ablehnungen`). Das Protokollieren ist
„best effort“ und verändert die Fehlermeldung nie.
