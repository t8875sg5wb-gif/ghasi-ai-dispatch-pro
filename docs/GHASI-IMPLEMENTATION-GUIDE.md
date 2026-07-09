# GHASI AI IMPLEMENTATION GUIDE

### Implementation Guide of GHASI AI — Version 1.0

*Dieses Dokument beschreibt die verbindlichen Regeln für die Umsetzung von GHASI AI. Es verbindet Constitution, Architecture, Domain Model, Roadmap, Design System und AI Blueprint mit der praktischen Entwicklung. Bei Konflikten hat die Constitution Vorrang.*

---

# Teil A – Zweck des Implementation Guides

Der Implementation Guide sorgt dafür, dass GHASI AI nicht zufällig weiterentwickelt wird.

Jede Änderung muss:

- zur Constitution passen

- mit der Architecture vereinbar sein

- dem Domain Model folgen

- die Roadmap unterstützen

- dem Design System entsprechen

- den AI Blueprint respektieren

- technisch sauber umgesetzt werden

- langfristig wartbar bleiben

Dieses Dokument ist die Brücke zwischen Idee und Umsetzung.

---

# Teil B – Grundregel der Umsetzung

GHASI AI wird nicht durch schnelle Einzelfunktionen besser.

GHASI AI wird besser durch:

- Stabilität

- klare Datenstruktur

- gute Verknüpfungen

- saubere Benutzerführung

- sichere Berechtigungen

- zuverlässige KI-Integration

- verständliche Prozesse

- konsequente Qualität

Neue Funktionen sind nur sinnvoll, wenn sie die Plattform als Ganzes verbessern.

---

# Teil C – Keine blinde Neuentwicklung

Bereiche, die bereits existieren, dürfen nicht neu erfunden werden.

Stattdessen gilt:

- bestehende Funktionen prüfen

- bestehende Funktionen stabilisieren

- bestehende Funktionen vereinheitlichen

- bestehende Funktionen verknüpfen

- bestehende Funktionen absichern

- bestehende Funktionen verbessern

Neue Module werden nur erstellt, wenn es fachlich notwendig ist und kein bestehender Bereich erweitert werden kann.

---

# Teil D – Reihenfolge jeder Umsetzung

Vor jeder Umsetzung wird geprüft:

1. Welche Grundlagendokumente sind betroffen?

2. Welches Geschäftsobjekt ist betroffen?

3. Welche Daten werden gelesen oder geschrieben?

4. Welche Rollen dürfen darauf zugreifen?

5. Welche UI-Komponenten werden genutzt?

6. Welche bestehenden Funktionen dürfen nicht beschädigt werden?

7. Welche Risiken entstehen?

8. Welche Tests sind nötig?

9. Welche KI-Regeln sind betroffen?

10. Wann gilt die Änderung als fertig?

Keine Umsetzung beginnt ohne diese Prüfung.

---

# Teil E – Priorität der Grundlagendokumente

Bei Konflikten gilt folgende Reihenfolge:

1. GHASI-CONSTITUTION

2. GHASI-ARCHITECTURE

3. GHASI-DOMAIN-MODEL

4. GHASI-ROADMAP

5. GHASI-DESIGN-SYSTEM

6. GHASI-AI-BLUEPRINT

7. GHASI-IMPLEMENTATION-GUIDE

Die Constitution schützt die Identität von GHASI AI.

Die Architecture schützt die technische Stabilität.

Das Domain Model schützt die fachliche Wahrheit.

Die Roadmap schützt die langfristige Richtung.

Das Design System schützt die Benutzererfahrung.

Der AI Blueprint schützt die KI-Identität.

Der Implementation Guide schützt die korrekte Umsetzung.

---

# Teil F – Rollen in der Umsetzung

## Lovable

Lovable ist der Baumeister der App.

Lovable setzt um:

- UI

- Komponenten

- Seiten

- Datenbankanbindung

- Supabase-Integration

- Workflows

- kleinere Refactorings

- dokumentennahe Produktverbesserungen

Lovable soll keine Architekturentscheidungen treffen, die den Grundlagendokumenten widersprechen.

## Claude Code

Claude Code ist der Senior Software Engineer.

Claude Code wird genutzt für:

- große Refactorings

- Codequalität

- TypeScript-Struktur

- Tests

- Sicherheit

- Performance

- technische Schulden

- komplexe Fehler

- Architekturprüfung

## ChatGPT

ChatGPT ist Produktarchitekt und strategischer Koordinator.

ChatGPT hilft bei:

- Anforderungen

- Dokumentation

- Architekturentscheidungen

- Prompt-Strategie

- fachlicher Prüfung

- Roadmap

- Review von Ergebnissen

- langfristiger Produktlogik

---

# Teil G – Umsetzung in Phasen

GHASI AI wird schrittweise umgesetzt.

Nicht alles gleichzeitig.

Die Reihenfolge lautet:

1. Fundament sichern

2. bestehende Bereiche vereinheitlichen

3. Daten verknüpfen

4. Sicherheit prüfen

5. Design konsistent machen

6. KI sinnvoll einbetten

7. Automatisierung vorbereiten

8. Integrationen später ergänzen

9. Skalierung erst nach Stabilität

Stabilität kommt vor Expansion.

---

# Teil H – Phase 1: Fundament sichern

Ziel:

Die bestehende App zuverlässig, sicher und wartbar machen.

Schwerpunkte:

- Datenbankstruktur prüfen

- Supabase-Anbindung prüfen

- Row Level Security prüfen

- Rollen prüfen

- Authentifizierung prüfen

- Demo-Daten entfernen oder klar trennen

- Fehlerzustände verbessern

- Ladezustände verbessern

- bestehende Seiten stabilisieren

- doppelte Logik reduzieren

- zentrale Komponenten nutzen

In dieser Phase werden keine großen neuen Bereiche gebaut.

---

# Teil I – Phase 2: Vereinheitlichung

Ziel:

Die Plattform soll sich wie ein einziges Produkt anfühlen.

Schwerpunkte:

- einheitliche Navigation

- einheitliche Layouts

- einheitliche Karten

- einheitliche Tabellen

- einheitliche Formulare

- einheitliche Detailseiten

- einheitliche Statusfarben

- einheitliche Button-Texte

- einheitliche Fehlertexte

Jede Seite soll wirken, als wäre sie von demselben Team gebaut worden.

---

# Teil J – Phase 3: Verknüpfungen

Ziel:

GHASI AI soll nicht aus isolierten Seiten bestehen.

Alle wichtigen Objekte sollen miteinander verbunden sein.

Beispiele:

- Auftrag mit Patient

- Auftrag mit Fahrer

- Auftrag mit Fahrzeug

- Auftrag mit Rechnung

- Auftrag mit Dokumenten

- Patient mit Aufträgen

- Fahrer mit Schichten

- Fahrzeug mit Wartung

- Rechnung mit Zahlung

- Dokument mit Geschäftsobjekt

- Aktivität mit Objektverlauf

Die App soll Zusammenhänge sichtbar machen.

---

# Teil K – Phase 4: Detailseiten stärken

Detailseiten sind zentrale Arbeitsorte.

Jede Detailseite soll zeigen:

- Stammdaten

- Status

- wichtige Kennzahlen

- verknüpfte Objekte

- Dokumente

- Verlauf

- Kommunikation

- Risiken

- Empfehlungen von GHASI AI

Eine Detailseite soll mehr sein als ein Formular.

Sie soll den vollständigen Kontext eines Objekts zeigen.

---

# Teil L – Phase 5: KI sinnvoll einbetten

GHASI AI darf nicht nur ein Chatfenster sein.

Die KI soll dort erscheinen, wo sie hilft:

- Dashboard

- Detailseiten

- Warnungen

- Rechnungen

- Aufträgen

- Fahrzeugen

- Fahrern

- Dokumenten

- Compliance

- Berichten

- Suche

KI-Ausgaben müssen:

- klar sein

- begründet sein

- Unsicherheit zeigen

- keine Daten erfinden

- keine Entscheidungen ohne Freigabe treffen

---

# Teil M – Phase 6: Automatisierung vorbereiten

Automatisierung wird vorsichtig eingeführt.

Zuerst darf GHASI AI nur vorbereiten:

- Vorschläge

- Entwürfe

- Erinnerungen

- Warnungen

- Prüfungen

- nächste Schritte

GHASI AI darf nicht automatisch:

- Rechnungen versenden

- Aufträge annehmen

- Fahrer verbindlich zuweisen

- Daten löschen

- externe Kommunikation senden

- Verträge abschließen

- Zahlungen buchen

Jede geschäftlich relevante Aktion braucht Freigabe.

---

# Teil N – Phase 7: Integrationen

Integrationen kommen erst, wenn das Fundament stabil ist.

Mögliche spätere Integrationen:

- E-Mail

- Kalender

- Karten / Routing

- Dokumentenspeicher

- Abrechnungssysteme

- Buchhaltung

- Fahrzeugdaten

- Versicherungen

- Vermittler

- Ausschreibungsquellen

Jede Integration braucht:

- klaren Zweck

- Datenmapping

- Berechtigungskonzept

- Fehlerbehandlung

- Protokollierung

- Abschaltmöglichkeit

- Datenschutzprüfung

---

# Teil O – Datenbankregeln

Die Datenbank ist die Quelle der Wahrheit.

Regeln:

- keine doppelten Daten ohne Grund

- keine Fake-Daten als echte Daten

- keine wichtigen Daten nur im Frontend

- keine unklaren Statuswerte

- keine Tabellen ohne fachlichen Zweck

- keine sensiblen Daten ohne Berechtigung

- Beziehungen sauber modellieren

- Fremdschlüssel nutzen, wo sinnvoll

- Statuswerte konsistent halten

Jede Tabelle muss fachlich begründet sein.

---

# Teil P – Supabase-Regeln

Supabase wird sauber und sicher genutzt.

Regeln:

- Row Level Security aktivieren

- Rollen sauber trennen

- sensible Daten schützen

- serverseitige Validierung nutzen

- keine geheimen Schlüssel im Frontend

- Uploads absichern

- Policies dokumentieren

- Fehler verständlich behandeln

- Datenänderungen nachvollziehbar machen

Sicherheit ist keine spätere Aufgabe.

Sicherheit gehört zur Umsetzung.

---

# Teil Q – Rollen und Berechtigungen

Jede Funktion muss wissen, wer sie nutzen darf.

Beispielrollen:

- Unternehmer

- Administrator

- Disponent

- Fahrer

- Buchhaltung

- Mitarbeiter

Regeln:

- Fahrer sehen nur notwendige Daten.

- Finanzdaten sind geschützt.

- Patientendaten sind geschützt.

- Kritische Aktionen sind eingeschränkt.

- Rollen dürfen nicht nur im UI versteckt werden.

- Berechtigungen müssen serverseitig abgesichert sein.

---

# Teil R – Datenschutz

GHASI AI arbeitet mit sensiblen Daten.

Besonders sensibel:

- Patientendaten

- Gesundheitsbezogene Transportdaten

- Fahrerinformationen

- Finanzdaten

- Dokumente

- Verträge

- Kommunikation

Regeln:

- nur notwendige Daten anzeigen

- keine unnötige Speicherung

- keine unnötige Wiederholung sensibler Daten in KI-Antworten

- Zugriff nach Rolle begrenzen

- Änderungen nachvollziehbar machen

- Daten nicht an externe Dienste geben, wenn es nicht nötig ist

---

# Teil S – UI-Umsetzung

Jede UI-Änderung folgt dem Design System.

Regeln:

- bestehende Komponenten wiederverwenden

- keine Sonderdesigns ohne Grund

- klare Hauptaktion

- verständliche Texte

- gute mobile Ansicht

- Ladezustände

- Fehlerzustände

- leere Zustände

- Status sichtbar machen

- Deep Links erhalten

Eine Seite ist nicht fertig, nur weil sie sichtbar ist.

Sie ist fertig, wenn sie verständlich, stabil und nutzbar ist.

---

# Teil T – Mobile Umsetzung

Mobile Ansichten werden eigenständig gedacht.

Besonders wichtig:

- Fahrer-App

- Statusänderungen

- Tagesübersicht

- Auftragsdetails

- Navigation

- Anrufaktionen

- Dokumente

- schnelle Bedienung

Regeln:

- große Buttons

- wenige Eingaben

- klare Reihenfolge

- keine komplexen Tabellen

- schnelle Ladezeiten

- gut lesbare Informationen

---

# Teil U – Fehlerbehandlung

Fehler müssen verständlich sein.

Ein guter Fehlertext erklärt:

- was passiert ist

- ob Daten gespeichert wurden

- was der Nutzer tun kann

- ob er es erneut versuchen soll

Keine rohen technischen Fehlermeldungen für normale Nutzer.

Fehler dürfen nicht still verschwinden.

---

# Teil V – Ladezustände und leere Zustände

Jede Ansicht braucht sinnvolle Zustände.

Ladezustände:

- Skeleton

- kurzer Hinweis

- Spinner nur wenn passend

Leere Zustände:

- erklären, was fehlt

- erklären, warum es wichtig ist

- nächste Aktion anbieten

Keine leeren weißen Seiten.

Keine verwirrenden Platzhalter.

---

# Teil W – Statuslogik

Statuswerte müssen eindeutig sein.

Beispiele:

Auftrag:

- neu

- disponiert

- unterwegs

- abgeschlossen

- storniert

Rechnung:

- Entwurf

- offen

- überfällig

- bezahlt

Fahrzeug:

- einsatzbereit

- unterwegs

- Wartung

- gesperrt

Status dürfen nicht mehrfach unterschiedlich benannt werden.

---

# Teil X – Dokumente und Uploads

Dokumente müssen immer einem Objekt zugeordnet werden können.

Beispiele:

- Patient

- Auftrag

- Fahrer

- Fahrzeug

- Rechnung

- Vertrag

- Einrichtung

- Kunde

Regeln:

- Dokumenttyp speichern

- Objektbezug speichern

- Upload-Datum speichern

- Sichtbarkeit nach Rolle prüfen

- sensible Dokumente schützen

- Vorschau ermöglichen, wenn sinnvoll

---

# Teil Y – Rechnungen und Finanzen

Finanzdaten müssen besonders sorgfältig umgesetzt werden.

Regeln:

- keine Fantasiebeträge

- klare Herkunft jeder Zahl

- Rechnungsstatus sauber führen

- Zahlungen nachvollziehbar speichern

- Ausgaben kategorisieren

- Umsatzsteuerlogik nicht vermischen

- §4 Nr.17b UStG berücksichtigen, wenn im Unternehmen gültig

- Steuerhinweise nicht als Steuerberatung darstellen

Finanzfunktionen müssen erklärbar und prüfbar sein.

---

# Teil Z – Krankenfahrdienst-Fachlichkeit

GHASI AI ist auf Krankenfahrdienst Schiene A ausgerichtet.

Die Umsetzung darf nicht mit folgenden Bereichen vermischt werden:

- Rettungsdienst

- qualifizierter Krankentransport

- KTW

- Notfallrettung

- medizinische Betreuung während der Fahrt

Schiene A umfasst insbesondere:

- sitzende Krankenfahrten

- Rollstuhltransport

- Tragestuhltransport

- Fahrten ohne medizinische Betreuung während der Fahrt

Fachliche Begriffe müssen sauber verwendet werden.

---

# Teil AA – KI-Umsetzung

KI-Funktionen müssen dem AI Blueprint folgen.

Regeln:

- eine KI-Persönlichkeit

- vier interne Denkbereiche

- keine erfundenen Daten

- Unsicherheit anzeigen

- Empfehlungen begründen

- keine autonomen Entscheidungen

- keine externen Aktionen ohne Freigabe

- sensible Daten nur wenn nötig verwenden

- Antworten verständlich formulieren

KI darf nicht wie ein isolierter Chatbot wirken.

KI ist Teil des gesamten Systems.

---

# Teil AB – Testregeln

Jede größere Änderung muss geprüft werden.

Zu prüfen sind:

- funktioniert die Seite?

- funktioniert sie mobil?

- bleiben bestehende Daten erhalten?

- funktionieren Rollen?

- funktionieren Fehlerzustände?

- funktionieren Ladezustände?

- sind Links stabil?

- werden keine Demo-Daten angezeigt?

- passt die Änderung zum Design System?

- widerspricht nichts den Grundlagendokumenten?

Tests sind Teil der Umsetzung.

---

# Teil AC – Keine Demo-App

GHASI AI ist keine Demo-App.

Verboten:

- Fake-Kennzahlen als echte Daten

- Demo-Patienten als echte Daten

- harte Beispielwerte

- zufällige Dummy-Texte

- unverbundene Beispielkarten

- Funktionen ohne echte Datenbasis

Wenn Beispieldaten nötig sind, müssen sie klar als Demo oder Test markiert sein.

---

# Teil AD – Performance

GHASI AI muss schnell bleiben.

Regeln:

- unnötige Datenabfragen vermeiden

- Listen paginieren, wenn sie groß werden

- schwere Berechnungen nicht unnötig im Frontend ausführen

- wiederholte Requests vermeiden

- Ladezustände nutzen

- Caching sinnvoll einsetzen

- mobile Performance beachten

Eine langsame App wirkt unprofessionell.

---

# Teil AE – Wartbarkeit

Code muss langfristig wartbar sein.

Regeln:

- klare Komponentenstruktur

- keine riesigen Dateien ohne Grund

- wiederverwendbare Hooks

- saubere Typen

- verständliche Namen

- keine doppelte Logik

- keine versteckten Nebenwirkungen

- keine unnötige Komplexität

Kurzfristige Lösungen dürfen die Zukunft nicht beschädigen.

---

# Teil AF – Review vor Abschluss

Vor Abschluss einer Umsetzung wird geprüft:

1. Entspricht die Änderung der Constitution?

2. Entspricht sie der Architecture?

3. Folgt sie dem Domain Model?

4. Unterstützt sie die Roadmap?

5. Entspricht sie dem Design System?

6. Respektiert sie den AI Blueprint?

7. Folgt sie diesem Implementation Guide?

8. Ist sie sicher?

9. Ist sie mobil nutzbar?

10. Ist sie verständlich?

11. Sind Fehlerzustände vorhanden?

12. Sind leere Zustände vorhanden?

13. Sind Rollen berücksichtigt?

14. Sind Daten echt und nachvollziehbar?

15. Wurde nichts Bestehendes beschädigt?

---

# Teil AG – Definition of Done

Eine Aufgabe gilt erst als fertig, wenn:

- sie fachlich korrekt ist

- sie technisch stabil ist

- sie visuell konsistent ist

- sie mobil funktioniert

- sie sichere Berechtigungen nutzt

- sie echte Daten korrekt verarbeitet

- sie Fehler verständlich behandelt

- sie keine unnötigen neuen Muster einführt

- sie mit den Grundlagendokumenten vereinbar ist

- sie für den Unternehmer echten Nutzen bringt

"Sichtbar" bedeutet nicht "fertig".

"Funktioniert einmal" bedeutet nicht "fertig".

"Fertig" bedeutet stabil, verständlich, sicher und nützlich.

---

# Teil AH – Schlussprinzip

GHASI AI wird nicht zufällig gebaut.

GHASI AI wird geführt.

Jede Umsetzung muss das Unternehmen stärker machen.

Jede Änderung muss die Plattform klarer, sicherer, intelligenter oder nützlicher machen.

Wenn eine Änderung nur mehr Komplexität bringt, aber keinen echten Nutzen, wird sie nicht umgesetzt.
