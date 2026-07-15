# GHASI Agent-Guardrails

**Status:** verbindlich für alle zukünftigen KI-/Agent-Läufe an GHASI AI.
**Erstellt:** 2026-07-15 (Phase P0_STORAGE).
**Verhältnis zu anderen Dokumenten:** ergänzt und wird gelesen zusätzlich zu
`GHASI-CONSTITUTION.md`, `GHASI-ARCHITECTURE.md`, `GHASI-DOMAIN-MODEL.md`,
`GHASI-ROADMAP.md`, `GHASI-AI-BLUEPRINT.md`, `GHASI-IMPLEMENTATION-GUIDE.md`.

Diese Datei fasst die dauerhaften Regeln zusammen, die für jeden Agent-Lauf
gelten – unabhängig vom aktuellen Prompt oder der aktuellen Phase.

---

## 1. Dokumenten-Hierarchie & Code-Realität

- Vor jeder Änderung sind die o. g. Dokumente vollständig zu lesen.
- Zusätzlich ist der **aktuelle Code**, die **aktuellen Migrationen** und der
  **aktuelle Datenbankzustand** zu inspizieren. Keine Änderungen auf Basis
  stale Annahmen aus früheren Audits.
- Bei Konflikt zwischen einem neuen Prompt und der Constitution/Architecture
  **stoppen und den Konflikt melden**, statt schleichend umzusetzen.

## 2. Ein Phasenlauf = ein Checkpoint

- Pro Chat wird **genau eine** ausgewählte Phase (`CURRENT_PHASE`) umgesetzt.
- Auch wenn eine spätere Phase klein wirkt: nicht mit anfangen.
- Mechanische Lint-/Formatierungsläufe gehören ausschließlich in den dafür
  vorgesehenen Hygiene-Checkpoint, **niemals** vermischt mit Migrationen
  oder Sicherheits-Refactors.

## 3. Keine Demo-Arrays als Produktionswahrheit

- Legacy-`INITIAL_*`-Arrays, statische Seeds und globale mutable Mirrors
  (`server-mirror.server.ts`-artige Muster) dürfen **nicht** als Quelle für
  KI-Kontext, Suche, Auswertungen oder Rechnungen dienen.
- Fehlt eine echte Datenquelle, wird der betroffene Abschnitt **weggelassen**,
  nicht durch Seeds ersetzt.

## 4. Request-scoped, serverseitig autorisierter Zugriff

- Sensible Daten (Patienten, Aufträge, Finanzen, Dokumente, GPS) werden in
  serverseitigen, **request-scoped** Abfragen mit der Identität des
  authentifizierten Nutzers geladen.
- UI-Sichtbarkeit ist **niemals** Autorisierung. Jede Mutation braucht
  serverseitige Rollen-/Objekt-Prüfung **und** RLS.
- Rolle und `driver_id` werden ausschließlich serverseitig aus
  `auth.uid()` abgeleitet, nie aus dem Client-Payload.

## 5. Serverseitige Validierung

- Jede Mutation braucht eine explizite Validierung (Feld-Allowlist, Typen,
  Enums, Längen). Server-erzeugte Felder (`id`, Zeitstempel, `user_id`,
  Rollen, Audit) sind niemals clientseitig schreibbar.
- Unbekannte Mutationsfelder werden **abgelehnt**, nicht stillschweigend
  entfernt.

## 6. Dokument-Storage (privat, server-owned)

- Der `documents`-Bucket ist **privat**. Keine Public URLs.
- Uploads laufen ausschließlich über eine authentifizierte Server-Route.
  Der Server leitet Nutzer/Rolle aus dem Bearer-Token ab und akzeptiert
  keine identitäts-, pfad-, id- oder zeitrelevanten Felder vom Client.
- Erlaubte Endformate: **PDF, JPEG/JPG, PNG, WebP**. Max. **10 MiB**.
- Server prüft Dateigröße, Endung, MIME **und** Datei-Signatur
  (Magic Bytes). Mismatch, SVG/HTML/Executables/Polyglots werden abgelehnt.
- Storage-Pfade werden **serverseitig** aus UUIDs erzeugt; der originale
  Dateiname erscheint niemals im Pfad, nur als validierte Metadatenspalte.
- Löschung erfolgt über die Server-Route per Dokument-ID; Storage-Pfade
  aus dem Client werden ignoriert. Löschungen sind idempotent und
  recovery-sicher: eine Zeile wird zuerst auf `pending_delete` markiert,
  erst nach nachgewiesenem Storage-Erfolg entfernt; ein Storage-Fehler wird
  niemals als Löscherfolg zurückgemeldet, und ein erneuter Aufruf finalisiert
  den vorbereiteten Zustand.
- Client-DTOs für Dokumente enthalten **niemals** `storage_path`,
  `uploaded_by` oder andere server-interne Felder. Listen selektieren nur eine
  explizite Spalten-Whitelist; `select("*")` ist verboten.
- Rollback von Storage-Änderungen darf den Bucket **niemals** öffentlich
  schalten (kein `storage_update_bucket('documents', true)`) und keine
  bestehenden Objekte löschen. Neue Schema-/Status-Spalten werden erst
  zurückgerollt, wenn keine `pending_delete`-Zeilen mehr existieren.
- Signierte URLs werden serverseitig anhand der Dokument-ID erzeugt, mit
  einer TTL von **≤ 600 Sekunden**, und im Client nicht über Ablauf hinaus
  gecacht.
- Cross-Service-Fehler (Storage ok, Metadaten fehlgeschlagen) werden
  kompensiert (Object entfernen). Orphan-Bereinigung ist vorgesehen.

## 7. Migrationen: Inventar, Rollback, Tests

- Vor jeder Migration/Backfill: Inventar (Zeilen-/Objektzahlen,
  Waisen, Legacy-Formate). Kein Preisgeben sensibler Namen/Inhalte.
- Reversibler Plan + Rollback-Pfad + Verifikationsquery/-test verpflichtend.
- Bestehende gültige Objekte müssen für autorisierte Rollen lesbar bleiben.
- Kein destruktives Umschreiben nur weil Seed-Daten einfach neu erzeugbar
  wären.

## 8. Schiene A & Minden-Seed-Regeln

- Erlaubte Fahrzeugtypen: **PKW | Rollstuhlfahrzeug | LMW**. Kein KTW,
  RTW, Notfalltransport, Rettungsdienst, keine medizinische Versorgung
  während der Fahrt. Einfacher Liege- und Tragestuhltransport bleiben
  innerhalb Schiene A erlaubt.
- Alle aktiven Demo-/Runtime-Daten sind Minden-basiert (MI-Kennzeichen,
  0571-Nummern). Keine Berliner Kennzeichen/Nummern in aktiven Seeds.

## 9. Rechts- & Finanzwerte: Quelle & Gültigkeit

- Werte in `gesetzeswerte.ts` (Minijob-Grenze, Mindestlohn, SV-Sätze,
  Zuzahlungen etc.) tragen Quelle und Gültigkeitszeitraum. „Geprüft am"
  wird nicht ohne Nachweis gesetzt.
- Der KI-Snapshot bezeichnet gesetzliche Werte präzise für ihren
  Gültigkeitszeitraum. Nur Schätzwerte werden als Näherung ausgewiesen.
- Keine Rechts-/Steuerberatung durch die KI.

## 10. Abschlussbericht (Pflichtformat)

Jeder Phasenlauf endet mit:

- ausgewählte Phase und Start-/End-Commit
- geänderte Dateien, Migrationen, Daten-/Backfill-Auswirkung
- erfüllte Akzeptanzkriterien
- ausgeführte Tests und exakte Ergebnisse (Befehle inkl. Ausgabe/Status)
- negative Autorisierungs-/Sicherheitstests
- Rollback-/Recovery-Hinweis
- bewusst übersprungene Arbeit + exakte nächste Phase
- verbleibende manuelle Aktionen des Unternehmers

## 11. Grenzen der Autonomie

- Keine Veröffentlichung, kein externer Versand (E-Mail, SMS, WhatsApp),
  keine Zahlungsauslösung, keine Google-Cloud-/Domain-Änderungen ohne
  ausdrückliche separate Anweisung.
- Smart Actions nur als **Entwurf**; Freigabe durch den Unternehmer.
- Keine irreversible Änderung an Produktionsdaten ohne Rollback.

## 12. Keine leeren Erfolgsmeldungen

- „Sauber", „sicher", „privat", „migriert", „behoben" nur mit **aktueller
  Evidenz** aus laufenden Tests/Queries. Keine Behauptungen ohne Beleg.
