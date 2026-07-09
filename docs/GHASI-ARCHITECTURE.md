# GHASI AI ARCHITECTURE

### Technical Architecture of GHASI AI — Version 1.0

*Technisches Grundlagendokument von GHASI AI. Ergänzt `docs/GHASI-CONSTITUTION.md`, ersetzt sie

nicht. Bei Konflikten hat die Constitution Vorrang. Anders als die Constitution beschreibt dieses

Dokument bewusst auch den **aktuellen, echten Stand** der Codebasis — nicht nur die Zielvision —

damit Lovable und Claude Code konkret wissen, worauf sie aufbauen.*

---

## 1. Architektur-Ziel

GHASI AI ist kein Bündel einzelner Module, sondern ein zusammenhängendes Unternehmenssystem für

einen Krankenfahrdienst der Schiene A (siehe Constitution, Artikel 10).

Drei Hauptziele:

1. **Einheitliche Datenbasis** — jede fachliche Information existiert genau einmal.

2. **Vollständige Verknüpfung** — alle Unternehmensobjekte sind miteinander verbunden.

3. **Intelligente Entscheidungsunterstützung** — GHASI AI nutzt Unternehmensdaten, Fachwissen und

   externe Informationen für nachvollziehbare Empfehlungen.

**Wichtige Ergänzung zum Maßstab:** Dies ist aktuell ein Einzelunternehmen mit überschaubarer

Fahrzeug-/Fahrerzahl. Die Architektur soll mit dem Unternehmen wachsen können — sie soll aber

nicht heute schon für eine Größe gebaut werden, die es noch nicht gibt. Wo ein einfacher

Mechanismus (z. B. ein Datenbank-Trigger plus Dashboard-Warnung) denselben Nutzen bringt wie ein

aufwendiges System, hat der einfache Mechanismus Vorrang (vgl. Constitution, Artikel 18:

„Nachhaltigkeit vor kurzfristigen Lösungen" — das schließt Überkonstruktion ausdrücklich ein).

---

## 2. Grundprinzipien

- Single Source of Truth

- Serverseitige Validierung (jede schreibende Aktion läuft über eine Server Function, nie direkt

  vom Client in die Datenbank)

- Rollenbasierte Sicherheit auf Datenbankebene (RLS) **und** auf Anwendungsebene

- Keine Demo-/Platzhalterdaten im Live-Betrieb — nur klar gekennzeichnete Schätzungen

- Keine doppelten States für dieselbe Information

- Keine isolierten Module ohne Verknüpfung zu verwandten Objekten

- Nachvollziehbare Datenflüsse

- Erweiterbarkeit ohne Kernbruch

- Bestehende Deep-Links bleiben erhalten

---

## 3. Systemschichten (Ist-Zustand + Zielbild)

### 3.1 Presentation Layer

Die Benutzeroberfläche: Seiten (`src/routes/*.tsx`), Tabs, Dialoge, Formulare, Detailansichten,

mobile Fahreransicht (`/fahrer-mobil`), Dashboard.

**Regel:** Diese Schicht enthält keine Geschäftslogik, die zentral gehört. Berechnungen (Steuer,

Preise, Warnungen) leben in `src/lib/*.ts`, nicht in der Seite selbst.

### 3.2 Application Layer

Workflows, Validierungen, Statuswechsel, Verknüpfungen, Koordination zwischen Modulen — heute

umgesetzt als React-Query-Hooks in den `*-store.ts`-Dateien (z. B. `orders-store.ts`,

`patients-store.ts`), die Server Functions aufrufen und den Cache aktualisieren.

**Ist-Zustand:** Wenn ein Auftrag angelegt/geändert wird, läuft das heute bereits über genau ein

solches Store-Hook-Muster, konsistent für alle 24 persistierten Datenbereiche.

### 3.3 Domain Layer

Die fachliche Unternehmenslogik. Zentrale Begriffe: Auftrag, Patient, Fahrer, Fahrzeug, Rechnung,

Einrichtung, Krankenkasse, Dokument, Kommunikation, Aktivität, Vertrag, Frist, Risiko, Empfehlung.

Heute verteilt auf `src/lib/*-shared.ts` (Typen/Konvertierung) und fachliche Module wie

`steuer.ts`, `finance.ts`, `ceo-intelligence.ts`, `compliance-dates.ts`.

### 3.4 Data Layer

Supabase-Tabellen, RLS, Foreign Keys, Migrationen, Server Functions

(`src/lib/*.functions.ts`, jede geschützt mit `requireSupabaseAuth`). Alle echten

Unternehmensdaten leben hier — nicht in den Legacy-Mirror-Arrays (siehe Constitution, Artikel 11).

### 3.5 Intelligence Layer

Die KI-Schicht: Antworten, Analysen, Empfehlungen, Erklärungen, Risikoerkennung, Wissensabruf,

Gedächtnis, Kontextbildung. Heute bereits umgesetzt für: KI-Assistent (Chat), Rechnungsprüfung,

KI-Verordnungs-Scan (`verordnung-scan.functions.ts`), CEO-Executive-Analyse.

Die KI interpretiert Daten, führt aber keine geschäftlichen Aktionen ohne Freigabe aus (siehe

Constitution, Artikel 9, und §10 dieses Dokuments).

### 3.6 Integration Layer

Externe Verbindungen. Heute bereits angebunden: Google Maps/Places (Geokodierung, Umgebungssuche).

Noch nicht angebunden, aber besprochen: DMRZ-Fahrtvermittlung (echte Partner-Schnittstelle

vorhanden, siehe Marktrecherche), QRAGO (nur Business-Tarif), Vermittler-Plattformen allgemein,

Sprachdienste. Jede externe Integration wird klar gekapselt (eigene `*.functions.ts`-Datei, kein

direkter Zugriff aus der UI).

---

## 4. Zentrale Unternehmensobjekte — Ist-Zustand der Verknüpfung

GHASI AI denkt in Objekten, nicht in Seiten. Stand heute, ehrlich nach „schon verknüpft" und

„noch offen" sortiert:

### Auftrag

Bereits verbunden mit: Patient, Fahrer, Fahrzeug, Rechnung (`bezugAuftrag`), Dokument (`bezug`).

Noch auszubauen: durchgängige GPS-/Statusanzeige direkt in der Auftragsdetailansicht,

Kommunikationsverlauf zum konkreten Auftrag sichtbar an einem Ort.

### Patient

Bereits verbunden mit: Kostenträger (echte Fremdschlüssel-Verknüpfung zu `insurers`),

Zuzahlungsbefreiung, Verordnung (`verordnung_vorhanden`, verlinktes Dokument), Genehmigungs-

Gültigkeit. Noch offen: Verlinkung zu allen seinen Aufträgen als echter Deep-Link (aktuell teils

nur gefilterte Liste auf derselben Seite, siehe Constitution Artikel 12).

### Fahrer

Bereits verbunden mit: Benutzerkonto/Rolle, zugewiesenes Fahrzeug, P-Schein-/Führungszeugnis-/SV-

Status, mobile Ansicht mit eigenen Touren. Noch offen: Schichtplan vollständig mit

Doppelbuchungsprüfung (Grundfunktion existiert, siehe `/schichtplan`), formale

Arbeitszeit-Auswertung.

### Fahrzeug

Bereits verbunden mit: Fahrer, TÜV/Wartung, Versicherung (`insurance_policies`), Leasing

(`leasing_contracts`), Fahrtenbuch, Live-/simuliertes GPS. Vollständig persistiert.

### Rechnung

Bereits verbunden mit: Auftrag, Kunde, Zahlungsstatus (echte Zahlungserfassung), Mahnstufe,

Änderungsprotokoll (`invoice_changes`), PDF-Export. Vollständig umgesetzt.

### Dokument

Bereits verbunden mit: Auftrag/Patient über `bezug`, echte Speicherung (Supabase Storage), Bild-/

PDF-Inline-Viewer. Grundsätzlich kein isoliertes Dokument mehr möglich — jeder Upload verlangt

einen Bezug.

---

## 5. Verknüpfungsarchitektur

Die Detailansicht eines Objekts ist der wichtigste Ort der Verknüpfung. Beim Öffnen eines Auftrags

soll sichtbar sein: Patient, Fahrer, Fahrzeug, Rechnung, Dokumente, Kommunikation, Verlauf —

jeweils als Link zum **konkreten** Datensatz (Constitution, Artikel 12). Dies ist für die meisten

Kernobjekte bereits umgesetzt; die in §4 genannten „noch offen"-Punkte sind der nächste

Ausbauschritt, nicht ein Neubau.

---

## 6. Navigation

Zielbild (Constitution, Artikel 13): sechs Hauptbereiche — Unternehmenszentrale, Leitstelle,

Personen, Finanzen, Unternehmen, GHASI AI.

**Ist-Zustand:** Der Einrichtungs-Hub (`/einrichtungen`, ehem. drei getrennte Seiten) und der

Analyse-Hub (`/ceo-cockpit` mit Tabs, ehem. sechs getrennte Seiten) sind bereits nach genau diesem

Muster zusammengeführt, alte Routen leiten weiter. Das ist die Blaupause für die restliche

Navigation — nicht neu erfinden, sondern dieses bewährte Muster (Hub-Seite mit Tabs + Redirects)

auf die übrigen Bereiche anwenden. Deep-Links dürfen dabei nicht brechen.

---

## 7. Datenfluss

UI → Store-Hook (React Query) → Server Function → Supabase → Rückgabe → Query-Cache → UI.

Direkter Datenbankzugriff aus UI-Komponenten wird vermieden, außer bei einfachen, reinen

Lesezugriffen ohne Geschäftslogik (z. B. Aktivitätsprotokoll-Anzeige).

---

## 8. Ereignislogik — bewusst als spätere Option, nicht als aktuelle Anforderung

Ein formales, durchgängiges Event-System (Auftrag erstellt/geändert/abgeschlossen → definierte

Kaskade von Folgeaktionen) ist ein Muster für größere Organisationen mit komplexen, variablen

Workflows. Für den heutigen Umfang des Unternehmens ist der Nutzen gegenüber dem Aufwand gering:

Die bereits bestehenden, einfacheren Mechanismen (Aktivitätsprotokoll bei relevanten Änderungen,

Dashboard-/Compliance-Warnungen, Toast-Benachrichtigungen) decken den heutigen Bedarf ab.

**Empfehlung:** Kein formales Event-System jetzt bauen. Diesen Abschnitt als Option vormerken,

falls das Unternehmen so wächst (mehr Fahrzeuge, mehr Personal, mehr Auftragsvolumen), dass

Kaskaden-Logik tatsächlich unübersichtlich wird. Vorher würde ein Event-System nur zusätzliche

Komplexität ohne spürbaren Nutzen bedeuten (vgl. Constitution, Artikel 18).

---

## 9. KI-Architektur

GHASI AI ist eine KI mit vier Denkbereichen (Geschäftsführer, Unternehmen, Experte, Welt) — als

Kontextbereiche und Wissensorganisation innerhalb einer einheitlichen Identität, **nicht** als vier

getrennte KI-Systeme (Constitution, Artikel 5). Die KI nutzt je nach Frage: Unternehmensdaten,

gespeichertes Wissen, Fachwissen, externe Informationen, Verlauf, aktuelle Risiken — alles in

einem Modellaufruf mit entsprechend zusammengestelltem Kontext.

## 10. KI-Regeln

GHASI AI darf: analysieren, erklären, empfehlen, vergleichen, warnen, zusammenfassen, Entwürfe

vorbereiten (z. B. Mahnungstexte, Verordnungs-Scan-Vorschläge — beide bereits so umgesetzt: nichts

wird ohne explizite Bestätigung gespeichert).

GHASI AI darf nicht ohne Freigabe: Aufträge verbindlich annehmen, Rechnungen versenden, Zahlungen

buchen, Daten löschen, Fahrer endgültig zuweisen, Verträge abschließen, rechtliche oder

steuerliche Entscheidungen als verbindlich darstellen.

---

## 11. Gedächtnis

Speichert: wichtige Entscheidungen, bestätigte Präferenzen, wiederkehrende Abläufe,

unternehmensspezifische Regeln, langfristige Ziele. Speichert nicht: unnötige private

Informationen, zufällige Chat-Inhalte, unbestätigte Annahmen, Rohdaten, die bereits in Tabellen

existieren (Constitution, Artikel 7).

---

## 12. Sicherheit — Ist-Zustand

Bereits umgesetzt: RLS auf allen sensiblen Tabellen, rollenbasierte Zugriffe, `requireSupabaseAuth`

ausnahmslos auf jeder Server Function mit erhöhten Rechten, keine automatische Rollenvergabe bei

Registrierung (nur der erste Account wird Admin), keine offenen Chat-Threads (pro Nutzer

abgegrenzt), keine geheimen Schlüssel im Client. Dies ist keine Zielvorgabe mehr, sondern

geprüfter, aktueller Stand — neue Funktionen müssen dieses Niveau halten, nicht erst erreichen.

---

## 13. Rollenmodell — Ist-Zustand

Bereits umgesetzt, vier Rollen:

- **Admin** — vollständiger Zugriff.

- **Disposition** — operative Bereiche (Aufträge, Fahrer, Fahrzeuge, Patienten), keine

  Finanzdaten außer notwendiger Auftragsinfos.

- **Finanz** — Rechnungen, Buchhaltung, Kosten, Auswertungen, keine unnötigen Patientendetails.

- **Fahrer** — nur eigene Touren, nur notwendige Patientendaten, Statusänderungen nur für eigene

  Fahrten (RLS-technisch bereits durchgesetzt, nicht nur UI-seitig verborgen).

---

## 14. Performance

Regeln für weiteres Wachstum: große Listen paginieren/virtualisieren, unnötige Re-Renders

vermeiden, Daten sinnvoll cachen (React Query übernimmt das größtenteils bereits), keine

mehrfachen identischen Requests, große Module lazy laden, mobile Nutzung priorisieren, Karten/

Live-Daten nur laden, wenn die jeweilige Ansicht sie braucht.

---

## 15. UX-Architektur

Wenige Hauptbereiche (§6), Detailansichten statt Seitenchaos, Tabs für Zusammengehöriges, klare

Primäraktionen, wichtige Informationen zuerst, keine doppelten Eingaben, mobile Bedienbarkeit,

große klickbare Elemente — besonders relevant für die Fahrer-Mobilansicht.

---

## 16. Fehlerbehandlung

Fehler werden sichtbar, verständlich und lösungsorientiert dargestellt — keine rohen technischen

Meldungen für normale Nutzer. Jeder Fehler sollte möglichst erklären: was passiert ist, was der

Nutzer tun kann, ob Daten gespeichert wurden oder nicht. Es existiert bereits eine globale

Fehlerseite mit Error-Reporting als Auffangnetz für unerwartete Abstürze.

---

## 17. Audit & Nachvollziehbarkeit

Das Aktivitätsprotokoll (bereits vorhanden, admin-only lesbar) beantwortet: Wer hat was gemacht?

Wann? Welche Daten waren betroffen? Für Rechnungen existiert zusätzlich ein dediziertes

Änderungsprotokoll (`invoice_changes`) als GoBD-orientierte Historie.

---

## 18. Erweiterbarkeit

Neue Bereiche sollen ergänzt werden können, ohne die Kernarchitektur zu zerstören. Mögliche

künftige Erweiterungen (bewusst nicht Teil des heutigen Umfangs, siehe Constitution Artikel 17):

Sprachfunktion, Markt-Radar/Vermittler-Analyse, formales Event-System (§8), Fördermittel-Monitor,

Benchmarking, externe Partnerportale (DMRZ, QRAGO).

---

## 19. Entwicklungsreihenfolge

1. Constitution *(fertig)*

2. Architecture *(dieses Dokument)*

3. Navigation vereinheitlichen (verbleibende Hauptbereiche nach dem Hub-Muster aus §6)

4. Verknüpfungen vervollständigen (die „noch offen"-Punkte aus §4)

5. Technische Vertiefung durch Claude Code (Performance, das mehrfach verschobene

   `server-mirror.server.ts`-Refactoring, Code-Bereinigung)

6. Gemeinsame große Visionen (Persönlichkeit durchgängig, Markt-Radar, Sprachfunktion — siehe

   Constitution Artikel 17)

---

## 20. Schlussprinzip

GHASI AI entwickelt keine einzelnen Module. GHASI AI entwickelt ein intelligentes Unternehmen.

Jede technische Entscheidung muss dieses Ziel unterstützen — und dabei im Maßstab des heutigen

Unternehmens bleiben, nicht für eine Größe bauen, die noch nicht erreicht ist.