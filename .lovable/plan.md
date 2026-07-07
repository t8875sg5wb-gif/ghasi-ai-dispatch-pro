## Ausgangslage

Die App ist bereits weit fortgeschritten. Vieles aus deiner Liste existiert schon und läuft über Lovable Cloud (Supabase):

- **Strukturierte Adressen** (Straße, Hausnummer, PLZ, Stadt, Land, Zusatz) gibt es bereits in `src/lib/address.ts` + `AddressFields`, sowohl für Aufträge als auch Daueraufträge.
- **Datenpersistenz** für Aufträge, Daueraufträge, Patienten, Fahrer, Fahrzeuge, Rechnungen läuft über Server-Funktionen + Supabase-Tabellen.
- **Geschäftsführer-Dashboard** (`src/routes/index.tsx`) zeigt Umsatz, offene/laufende Aufträge, nicht zugewiesene Fahrten, Warnungen und Auslastung.
- **Akten**: Patienten- (`patienten.tsx`), Fahrer- (`fahrer.tsx` + `fahrer-detail.tsx`), Fahrzeugakte (`fahrzeuge.tsx` + `fahrzeug-detail.tsx`) sind vorhanden.
- **Warnungen** existieren teilweise (nicht zugewiesen, Fahrzeug-Mismatch, Fristen).

Ich baue also **nichts doppelt**, sondern schließe gezielt die Lücken und behebe den Absturz. So bleiben deine Credits geschont.

---

## Was ich umsetze (in Reihenfolge)

### 1. Aufträge-Seite: kein Absturz, keine Weiterleitung zur Startseite
- Ursache des Fehlers `resolveDispatcher().use` ist mit hoher Wahrscheinlichkeit eine doppelte React-Instanz aus dem Dev-Test-Tooling (vitest/jsdom/@testing-library), das früher hinzugefügt wurde. Ich entferne diese Dev-Dependencies und leere den Vite-Dep-Cache, sodass nur eine React-Version gebündelt wird.
- Zusätzlich bekommt die Route `/auftraege` **eigene** `errorComponent` + `notFoundComponent`, die einen sauberen Fehlerzustand mit „Erneut laden" anzeigen — statt in den Root-Error-Screen zu fallen, der einen „Go home"-Link zeigt (der wie eine Weiterleitung wirkt).
- Verifikation per Playwright: Seite lädt, kein Blank-Screen, keine Navigation weg.

### 2. Aufträge als Tabs statt einer langen Liste
Die aktuelle Datums-Gruppierung wird in echte **Tabs/Fenster** umgebaut:
`Heute · Morgen · Übermorgen · Diese Woche · Nächste Woche · Daueraufträge`
- Neue Bucket-Logik in `src/lib/order-urgency.ts` (Diese Woche / Nächste Woche als eigene Kategorien).
- `auftraege.tsx` nutzt `Tabs` (shadcn) mit Zähler-Badges pro Tab; Suche/Filter bleiben aktiv.
- Der Tab „Daueraufträge" zeigt die aktiven Serien direkt hier (verlinkt auf die Detailverwaltung).
- Mobil: horizontal scrollbare Tab-Leiste.

### 3. + 4. Strukturierte Adressen absichern (Aufträge & Daueraufträge)
- Prüfen, dass Auftrags- und Dauerauftrags-Formular alle sechs Felder (Straße, Hausnummer, PLZ, Stadt, Land, Zusatzinfo) sauber speichern und beim Bearbeiten wieder befüllen.
- Fehlende/legacy Adressen werden über die vorhandenen Parser migriert (keine Datenänderung nötig, rückwärtskompatibel).

### 5. Automatische Warnungen vervollständigen
Zentralisiert in `order-urgency.ts` und sichtbar in Liste, Dashboard und Alert-Center:
- **Fahrt bald ohne Fahrer** — vorhanden, bleibt.
- **Rollstuhl/Liegend ohne passendes Fahrzeug** — vorhanden (`fahrzeugMismatch`), wird in die zentrale Warnlogik gehoben.
- **Adresse fehlt** — neu: Abhol- oder Zieladresse unvollständig.
- **Telefonnummer fehlt** — neu: benötigt ein Telefonfeld (siehe Punkt 8).
- **Fahrer doppelt eingeplant** — neu: gleicher Fahrer mit sich zeitlich überschneidenden aktiven Aufträgen.

### 6. Geschäftsführer-Dashboard finalisieren
Sicherstellen, dass eine klare Kennzahlen-Reihe genau enthält: Fahrten heute · offene Fahrten · nicht zugewiesene Fahrten · dringende Warnungen · geschätzte Einnahmen · offene Rechnungen. Fehlende Kacheln ergänze ich, der Rest bleibt.

### 7. Akten verifizieren
Patienten-, Fahrer- und Fahrzeugakte sind vorhanden — ich prüfe Vollständigkeit (Detailansicht + Bearbeiten) und ergänze das Telefonfeld in der Patienten-/Auftragsansicht.

### 8. + 9. Datenbank sauber erweitern (ohne Datenverlust)
Nicht-destruktive Migration (`ADD COLUMN IF NOT EXISTS`):
- `orders.telefon` (Kontakt für den Transport) + ggf. `patients.telefon`.
- Strukturierte Adressspalten sind bereits vorhanden; nur ergänzen, falls einzelne fehlen.
- Bestehende Zeilen bleiben unverändert; neue Spalten sind nullbar mit sinnvollem Default.

### 10. Mobil & Desktop
Alle geänderten Ansichten (Tabs, Warn-Badges, KPI-Grid) nach dem Responsive-Muster (grid + `min-w-0` + `shrink-0`, scrollbare Tabs) prüfen; Playwright-Screenshots in Mobil- (393px) und Desktop-Breite.

---

## Technische Details
- Migration über das Migrations-Tool (Freigabe durch dich), danach Typen-Regeneration, dann Code, der die neuen Spalten nutzt.
- Warnlogik komplett clientseitig aus bereits geladenen Daten — keine neuen Server-Roundtrips.
- Doppelbuchungs-Erkennung: Aufträge nach Fahrer gruppieren, aktive Termine mit angenommener Fahrtdauer auf Überschneidung prüfen.
- Entfernen von `vitest`, `jsdom`, `@testing-library/react` aus devDependencies zur Auflösung der doppelten React-Instanz.

## Verifikation
- Build/Typecheck grün.
- Playwright: `/auftraege` lädt ohne Crash/Redirect, Tabs schaltbar, Warnungen sichtbar, mobil + Desktop.
