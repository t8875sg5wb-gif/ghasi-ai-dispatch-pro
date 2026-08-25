# GHASI AI Executive — MCP-Tool-Dokumentation

MCP-Server: `ghasi-ai-executive` (Titel „GHASI AI Executive", Version 0.1.0)
Endpunkt: `https://<projekt-domain>/mcp`
Auth: OAuth 2.1 über Lovable Cloud Auth (`acceptedAudiences: "authenticated"`).
Jeder Request braucht ein gültiges Bearer-Token; alle Abfragen laufen als der
angemeldete Benutzer, RLS greift also unverändert.

Alle 5 Tools sind **rein lesend** (`readOnlyHint: true`, `idempotentHint: true`,
`openWorldHint: false`). Antworten enthalten immer

- `content[0].text` — die Daten als eingerücktes JSON (für die Modellanzeige),
- `structuredContent` — dieselben Daten maschinenlesbar,
- bei Fehlern `isError: true` und eine deutsche Klartextmeldung.

Häufige Fehlermeldungen: `"Nicht authentifiziert."`, `"Auftrag nicht gefunden."`,
`"Bitte 'id' oder 'nummer' angeben."` sowie durchgereichte Datenbankfehler.

---

## 1. `list_orders` — Aufträge auflisten

Listet Krankentransport-Aufträge, sortiert nach `termin` (absteigend).

| Parameter | Typ | Pflicht | Beschreibung |
| --- | --- | --- | --- |
| `status` | string | nein | Statusfilter, z. B. `neu`, `geplant`, `in_fahrt`, `abgeschlossen` |
| `limit` | integer 1–100 | nein | Max. Ergebnisse, Standard 25 |

Beispiel-Request:

```json
{ "name": "list_orders", "arguments": { "status": "geplant", "limit": 2 } }
```

Beispiel-Response (`structuredContent`):

```json
{
  "orders": [
    {
      "id": "8f1c…",
      "nummer": "A-2026-0042",
      "patient": "Maria Schulz",
      "abholort": "Bahnhofstr. 12, 49074 Osnabrück",
      "zielort": "Klinikum, Am Finkenhügel 1, 49076 Osnabrück",
      "termin": "2026-08-26T08:30:00+02:00",
      "status": "geplant",
      "prioritaet": "normal",
      "mobilitaet": "rollstuhl"
    }
  ],
  "count": 1
}
```

## 2. `get_order` — Auftrag abrufen

Einzelner Auftrag per UUID **oder** Auftragsnummer. Mindestens eines von beiden
muss gesetzt sein; ist `id` gesetzt, hat es Vorrang.

| Parameter | Typ | Pflicht | Beschreibung |
| --- | --- | --- | --- |
| `id` | string (UUID) | nein* | UUID des Auftrags |
| `nummer` | string | nein* | Auftragsnummer, z. B. `A-2026-0042` |

\* genau eines von beiden ist erforderlich.

Beispiel-Request:

```json
{ "name": "get_order", "arguments": { "nummer": "A-2026-0042" } }
```

Beispiel-Response (`structuredContent`):

```json
{
  "order": {
    "id": "8f1c…",
    "nummer": "A-2026-0042",
    "patient": "Maria Schulz",
    "termin": "2026-08-26T08:30:00+02:00",
    "status": "geplant",
    "fahrer": "Ali Demir",
    "fahrzeug": "OS-GH 120",
    "kostentraeger": "AOK Niedersachsen"
  }
}
```

Fehlerfall (kein Treffer):

```json
{ "content": [{ "type": "text", "text": "Auftrag nicht gefunden." }], "isError": true }
```

## 3. `list_drivers` — Fahrer auflisten

Alle Fahrer der eigenen Firma, sortiert nach Name (aufsteigend).

| Parameter | Typ | Pflicht | Beschreibung |
| --- | --- | --- | --- |
| `status` | string | nein | z. B. `aktiv`, `krank`, `urlaub` |
| `limit` | integer 1–200 | nein | Max. Ergebnisse, Standard 100 |

Beispiel-Request:

```json
{ "name": "list_drivers", "arguments": { "status": "aktiv" } }
```

Beispiel-Response (`structuredContent`):

```json
{
  "drivers": [
    {
      "id": "3ad2…",
      "nummer": "F-004",
      "name": "Ali Demir",
      "telefon": "+49 541 123456",
      "status": "aktiv",
      "vertragsart": "vollzeit",
      "pSchein": { "vorhanden": true, "gueltigBis": "2027-03-31" },
      "urlaubstage": 30,
      "krankheitstage": 2
    }
  ],
  "count": 1
}
```

## 4. `list_vehicles` — Fahrzeuge auflisten

Gesamte Flotte, sortiert nach Kennzeichen (aufsteigend).

| Parameter | Typ | Pflicht | Beschreibung |
| --- | --- | --- | --- |
| `status` | string | nein | z. B. `verfuegbar`, `im_einsatz`, `wartung` |
| `limit` | integer 1–200 | nein | Max. Ergebnisse, Standard 100 |

Beispiel-Request:

```json
{ "name": "list_vehicles", "arguments": { "status": "verfuegbar", "limit": 5 } }
```

Beispiel-Response (`structuredContent`):

```json
{
  "vehicles": [
    {
      "id": "b71e…",
      "nummer": "KFZ-01",
      "kennzeichen": "OS-GH 120",
      "marke": "VW",
      "modell": "Caddy",
      "baujahr": 2023,
      "typ": "PKW",
      "rollstuhlGeeignet": true,
      "liegendGeeignet": false,
      "status": "verfuegbar",
      "tuevBis": "2027-05-31"
    }
  ],
  "count": 1
}
```

## 5. `list_invoices` — Rechnungen auflisten

Rechnungen und Gutschriften, sortiert nach `datum` (absteigend).

| Parameter | Typ | Pflicht | Beschreibung |
| --- | --- | --- | --- |
| `status` | string | nein | z. B. `offen`, `bezahlt`, `ueberfaellig` |
| `limit` | integer 1–100 | nein | Max. Ergebnisse, Standard 25 |

Beispiel-Request:

```json
{ "name": "list_invoices", "arguments": { "status": "offen", "limit": 3 } }
```

Beispiel-Response (`structuredContent`):

```json
{
  "invoices": [
    {
      "id": "c902…",
      "nummer": "R-2026-0187",
      "typ": "rechnung",
      "kunde": "AOK Niedersachsen",
      "abrechnungsart": "kostentraeger",
      "betrag": 412.5,
      "mwstSatz": 7,
      "status": "offen",
      "datum": "2026-08-10",
      "faelligkeit": "2026-09-09",
      "bezahltAm": null
    }
  ],
  "count": 1
}
```

---

## Hinweise für Clients

- Beträge sind Netto-Werte in Euro; `mwstSatz` ist ein Prozentwert.
- Datumsfelder sind ISO-Strings (`YYYY-MM-DD` bzw. vollständiges ISO-Datum mit Zeit).
- Der Statusfilter ist eine exakte Gleichheitsprüfung — unbekannte Werte liefern
  eine leere Liste (`count: 0`), keinen Fehler.
- Es gibt bewusst keine schreibenden Tools; Änderungen erfolgen nur in der App.
