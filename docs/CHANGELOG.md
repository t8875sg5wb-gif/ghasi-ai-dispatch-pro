# Changelog – Dokumentation & API

## 2026-09-10

### API-Fehlertypen für Daueraufträge (neu, für Client-Teams)

`createRecurring` und `updateRecurring` liefern Validierungsfehler jetzt in
einem dokumentierten, strukturierten Format statt Freitext:

- **Marker:** `__GHASI_FELDFEHLER__` in `error.message`, gefolgt von JSON
  `{"fields": [...]}`.
- **Feldfehler-Typ:** `{ path, label, message }` – Punkt-Pfad ohne
  `values.`-Präfix, deutsches Label, verständliche Meldung.
- **Kodierungsregeln:** First-error-wins pro Pfad, Deduplizierung,
  Fallback-Pfad `formular`, Array-Pfade z. B. `wochentage.0`.
- **Dokumentation:**
  [docs/API-FEHLERFORMAT-DAUERAUFTRAEGE.md](./API-FEHLERFORMAT-DAUERAUFTRAEGE.md)
  (Lesefassung inkl. Client-Dekodier-Helfer) und
  [docs/openapi-dauerauftraege.yaml](./openapi-dauerauftraege.yaml)
  (maschinenlesbar, `x-ghasi-field-error-marker` /
  `x-ghasi-field-error-encoding`).
- **Verhalten abgesichert:** End-to-End-Tests in
  `src/lib/recurring-e2e-fehlerstruktur.test.ts` verifizieren die exakte
  Fehlerstruktur (path, label, message) über die gesamte Serverpipeline.
- **Hinweis:** Abgelehnte Versuche werden zusätzlich serverseitig in
  `recurring_rejections` protokolliert (Admin-Bericht
  `/dauerauftrag-ablehnungen`).

### Doku-Übersicht

Neue kuratierte Einstiegsseite: [docs/README.md](./README.md).
