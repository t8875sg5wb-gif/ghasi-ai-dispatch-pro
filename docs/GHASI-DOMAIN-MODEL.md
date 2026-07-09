# GHASI AI DOMAIN MODEL

### Fachliches Domain Model von GHASI AI — Version 1.0

*Offizielles fachliches Grundlagendokument von GHASI AI Executive.*

Dieses Dokument ergänzt:

- `docs/GHASI-CONSTITUTION.md`

- `docs/GHASI-ARCHITECTURE.md`

Es ersetzt diese Dokumente nicht.

Bei Konflikten gilt folgende Reihenfolge:

1. Constitution

2. Architecture

3. Domain Model

4. Roadmap

5. Implementation Guide

6. Einzelne Prompts

Dieses Dokument beschreibt die fachlichen Objekte, Begriffe, Beziehungen und Grenzen von GHASI AI.

Es ist ausdrücklich kein technischer Umbauauftrag.

---

# Teil A – Zweck des Domain Models

Das Domain Model erklärt, wie GHASI AI fachlich über das Unternehmen denkt.

GHASI AI ist keine Sammlung einzelner Seiten.

GHASI AI ist ein zusammenhängendes Unternehmenssystem für einen Krankenfahrdienst.

Das Domain Model beantwortet:

- Welche fachlichen Objekte gibt es?

- Wie hängen diese Objekte zusammen?

- Welche Begriffe dürfen nicht verwechselt werden?

- Welche Daten gehören zu welchem Objekt?

- Welche Beziehungen sind fachlich wichtig?

- Was ist aktueller Ist-Zustand?

- Was ist langfristiges Zielmodell?

- Was darf nicht automatisch als Sofort-Aufgabe verstanden werden?

Das Domain Model beschreibt fachliche Wahrheit, nicht automatisch technische Tabellen.

Ein Objekt im Domain Model bedeutet nicht automatisch:

- dass bereits eine eigene Datenbanktabelle existiert

- dass sofort eine Tabelle gebaut werden muss

- dass sofort eine UI-Seite gebaut werden muss

- dass sofort eine Migration nötig ist

- dass bestehende funktionierende App-Logik umgebaut werden soll

---

# Teil B – Grundprinzip

GHASI AI denkt in verbundenen Unternehmensobjekten.

Jedes Objekt hat eine klare Bedeutung.

Jedes Objekt soll langfristig mit allen relevanten anderen Objekten verbunden sein.

Es darf keine doppelte Wahrheit geben.

Eine Information darf fachlich nur an einer Stelle verantwortlich gepflegt werden.

Andere Stellen dürfen diese Information anzeigen, verlinken oder daraus berechnen, aber nicht als zweite Wahrheit speichern.

Beispiel:

- Der Patient ist die Quelle für Patientendaten.

- Der Fahrer ist die Quelle für Fahrerinformationen.

- Das Fahrzeug ist die Quelle für Fahrzeugdaten.

- Der Auftrag ist aktuell die zentrale operative Einheit.

- Die Rechnung ist die Quelle für Abrechnungsstatus und Zahlungsstatus.

- Das Dokument ist die Quelle für gespeicherte Nachweise.

- Das Aktivitätsprotokoll ist die Quelle für nachvollziehbare Änderungen.

---

# Teil C – Domain Model ist nicht gleich Datenbankmodell

Dieses Domain Model ist fachlich.

Es beschreibt Objekte und Beziehungen.

Die technische Umsetzung kann anders aussehen.

Ein fachliches Objekt kann technisch sein:

- eine eigene Tabelle

- ein Teil einer bestehenden Tabelle

- eine berechnete Ansicht

- ein UI-Zustand

- ein späteres Zielmodell

- eine logische Gruppierung mehrerer Datenfelder

Technische Umsetzung darf erst erfolgen, wenn:

- aktueller App-Zustand geprüft wurde

- bestehende Tabellen geprüft wurden

- bestehende UI geprüft wurde

- Auswirkungen auf Fahrer-App geprüft wurden

- Auswirkungen auf Disposition geprüft wurden

- Auswirkungen auf Rechnungen geprüft wurden

- Auswirkungen auf GPS und Statuslogik geprüft wurden

- Migrationsrisiko geprüft wurde

- Nutzen und Aufwand geprüft wurden

- der Unternehmer ausdrücklich freigegeben hat

---

# Teil D – Fachlicher Geltungsbereich

GHASI AI ist für einen Krankenfahrdienst der Schiene A bestimmt.

Der fachliche Fokus liegt auf:

- sitzenden Krankenfahrten

- Rollstuhltransporten

- Tragestuhltransporten

- Fahrten ohne medizinische Betreuung während der Fahrt

- Fahrten zu Ärzten, Kliniken, Dialyse, Therapie, Reha, Entlassung, Aufnahme oder privaten medizinischen Zwecken

- Abrechnung mit Krankenkassen, sonstigen Kostenträgern, Einrichtungen oder Selbstzahlern

- Disposition, Fahrer, Fahrzeuge, Patienten, Dokumente, Rechnungen, Zahlungen und Unternehmenssteuerung

GHASI AI ist nicht für qualifizierten Krankentransport als Rettungsdienstsystem gedacht.

GHASI AI darf nicht automatisch Anforderungen aus folgenden Bereichen übernehmen:

- Rettungsdienst

- KTW-Betrieb

- Notfallrettung

- Rettungswagen

- Rettungssanitäterpflicht

- Rettungshelferpflicht

- RettG-NRW-spezifische Einsatzlogik

- medizinische Betreuung während der Fahrt

- Einsatzleitsysteme für Notfälle

Falls in der App oder in alten Daten Begriffe wie „liegend“ vorkommen, bedeutet das nicht automatisch KTW oder Rettungsdienst.

Liegende Beförderung darf nur dann fachlich eingeordnet werden, wenn sie rechtlich, vertraglich und betrieblich zur Schiene A passt und keine medizinische Betreuung während der Fahrt erfordert.

Unklare Fälle müssen als Risiko markiert und separat geprüft werden.

---

# Teil D1 – Aktueller Stand und Zielmodell

Dieses Domain Model beschreibt sowohl den aktuellen fachlichen Kern als auch das langfristige Zielmodell von GHASI AI.

## Aktueller Stand

- Ein Auftrag ist aktuell die zentrale operative Einheit.

- Ein Auftrag enthält heute bereits viele Informationen zur Durchführung, zum Fahrer, zum Fahrzeug, zum Status und zur Abrechnung.

- Es gibt aktuell noch kein vollständig getrenntes Fahrt-Objekt als eigenständige operative Datenstruktur.

- Rechnungen arbeiten aktuell noch überwiegend mit einfachen Beträgen und nicht mit vollständig strukturierten Rechnungspositionen.

- GHASI-AI-Hinweise sind aktuell überwiegend berechnete oder angezeigte Empfehlungen und noch nicht zwingend dauerhaft gespeicherte Empfehlungsobjekte mit eigenem Statusverlauf.

## Langfristiges Zielmodell

- Auftrag und Fahrt können später fachlich getrennt werden.

- Ein Auftrag kann später eine oder mehrere Fahrten enthalten.

- Rechnungen können später aus strukturierten Rechnungspositionen bestehen.

- GHASI-AI-Empfehlungen können später als eigene Objekte mit Status, Verlauf und Entscheidung des Unternehmers gespeichert werden.

Diese Zielmodell-Elemente dürfen nicht automatisch als sofortiger Umbau verstanden werden.

Jede Einführung eigener Objekte für Fahrt, Rechnungsposition oder GHASI-AI-Empfehlung benötigt eine separate technische Planung, Risikoanalyse und ausdrückliche Freigabe durch den Unternehmer.

---

# Teil E – Zentrale Objektlandkarte

GHASI AI besteht fachlich aus folgenden Kernobjekten:

- Unternehmer

- Benutzer

- Rolle

- Patient

- Auftrag

- Fahrt

- Fahrer

- Fahrzeug

- Einrichtung

- Kunde

- Auftraggeber

- Kostenträger

- Rechnungsempfänger

- Krankenkasse

- Vertrag

- Preisvereinbarung

- Dokument

- Verordnung

- Rechnung

- Rechnungsposition

- Zahlung

- Mahnung

- Ausgabe

- Lohn

- Schicht

- Wartung

- Versicherung

- Leasingvertrag

- Kommunikation

- Aktivität

- Aufgabe

- Erinnerung

- Compliance-Frist

- Risiko

- Warnung

- Kennzahl

- GHASI-AI-Hinweis

- GHASI-AI-Empfehlung

- KI-Gedächtnis

- Marktquelle

- Integration

Nicht jedes Objekt muss heute technisch als eigene Tabelle existieren.

Nicht jedes Objekt muss heute als eigene Seite existieren.

---

# Teil F – Unternehmer

Der Unternehmer ist die oberste Entscheidungsinstanz.

GHASI AI darf den Unternehmer unterstützen, warnen, analysieren und Empfehlungen geben.

GHASI AI darf nicht ohne Freigabe des Unternehmers geschäftlich handeln.

Der Unternehmer entscheidet insbesondere über:

- neue Aufträge

- Preisannahmen

- Investitionen

- Fahrzeuge

- Personal

- Verträge

- Rechnungsversand

- Mahnungen

- Löschungen

- Integrationen

- externe Datenübermittlungen

- rechtlich oder steuerlich relevante Entscheidungen

- technische Umbauten mit Risiko

GHASI AI ist ein digitaler Geschäftsführer, aber nicht der rechtliche Geschäftsführer.

Die Verantwortung bleibt beim Unternehmer.

---

# Teil G – Benutzer

Ein Benutzer ist eine Person mit Zugriff auf GHASI AI.

Benutzer können sein:

- Unternehmer

- Admin

- Disponent

- Finanz-Benutzer

- Fahrer

- externer Helfer

- später eventuell Steuerberater oder Buchhaltung

Ein Benutzer ist nicht automatisch ein Fahrer.

Ein Fahrer kann ein Benutzer sein, muss aber fachlich getrennt betrachtet werden.

Ein Benutzer beschreibt Zugriff.

Ein Fahrer beschreibt operative Tätigkeit.

---

# Teil H – Rolle

Eine Rolle beschreibt Berechtigungen.

Rollen regeln, was ein Benutzer sehen, ändern oder ausführen darf.

Wichtige Rollen:

- Admin

- Disposition

- Finanz

- Fahrer

Grundregel:

Jede Rolle sieht nur die Daten, die sie für ihre Aufgabe benötigt.

Fahrer sehen nur eigene Touren, eigene Aufträge oder eigene Einsatzdaten.

Finanz sieht Rechnungen, Zahlungen, Kosten und Auswertungen, aber keine unnötigen Patientendetails.

Disposition sieht operative Daten, aber nicht unnötige Finanzdetails.

Admin sieht alles.

Rollen sind Sicherheitsobjekte, keine Design-Dekoration.

---

# Teil I – Patient

Ein Patient ist die beförderte Person.

Der Patient ist die fachliche Quelle für:

- Name

- Telefonnummer

- Adresse

- Mobilität

- besondere Hinweise

- Krankenkasse oder Kostenträger-Bezug

- Versichertennummer, falls vorhanden

- Zuzahlungsbefreiung

- Verordnung

- Genehmigungsstatus

- Genehmigung gültig bis

- relevante Dokumente

- wiederkehrende Fahrtmuster

- besondere Risiken oder Hinweise

Ein Patient darf nicht mit Auftraggeber verwechselt werden.

Ein Patient darf nicht mit Rechnungsempfänger verwechselt werden.

Ein Patient darf nicht automatisch Kostenträger sein.

Ein Patient kann Selbstzahler sein.

Ein Patient kann aber auch über Krankenkasse, Einrichtung, Sozialamt, Berufsgenossenschaft oder andere Kostenträger abgerechnet werden.

---

# Teil J – Mobilität

Mobilität beschreibt, wie der Patient befördert werden muss.

Typische Mobilitätsarten:

- gehfähig

- sitzend

- Rollstuhl

- Tragestuhl

- liegend, falls rechtlich und betrieblich zulässig

Mobilität beeinflusst:

- Fahrzeugauswahl

- Fahreranforderung

- Zeitbedarf

- Preis

- Risiko

- Abrechnung

- Dokumentationspflicht

- Disposition

Mobilität ist keine reine Textnotiz.

Mobilität ist ein fachlicher Steuerungswert.

Wenn Mobilität unklar ist, muss GHASI AI warnen.

---

# Teil K – Verordnung

Eine Verordnung ist ein medizinisch oder abrechnungstechnisch relevantes Dokument zur Krankenbeförderung.

Die Verordnung kann Informationen enthalten zu:

- Patient

- Geburtsdatum

- Krankenkasse

- Versichertennummer

- Transportart

- Einzel- oder Dauerfahrt

- Zeitraum

- Arzt

- medizinischer Anlass

- Genehmigungspflicht

- Abrechnungsrelevanz

Eine Verordnung ist nicht automatisch eine Genehmigung.

Eine Verordnung ist nicht automatisch eine Rechnung.

Eine Verordnung ist ein Nachweisobjekt und muss mit Patient, Auftrag oder Rechnung verknüpft werden können.

KI darf eine Verordnung auslesen, aber erkannte Gesundheits- oder Abrechnungsdaten dürfen nicht ungeprüft gespeichert werden.

Jede KI-Erkennung muss durch den Benutzer bestätigt werden.

---

# Teil L – Krankenkasse

Eine Krankenkasse ist ein möglicher Kostenträger.

Eine Krankenkasse kann verbunden sein mit:

- Patienten

- Genehmigungen

- Preisvereinbarungen

- Verträgen

- Rechnungen

- Zahlungen

- Abrechnungsregeln

- Ansprechpartnern

- IK-Nummern oder sonstigen Abrechnungsdaten

Eine Krankenkasse ist nicht automatisch Auftraggeber.

Eine Krankenkasse ist nicht automatisch Rechnungsempfänger, auch wenn sie häufig Rechnungsempfänger sein kann.

Eine Krankenkasse darf nicht mit Kunde gleichgesetzt werden.

---

# Teil M – Kostenträger

Der Kostenträger ist die Stelle, die die Kosten fachlich oder vertraglich trägt.

Mögliche Kostenträger:

- Krankenkasse

- Pflegekasse

- Berufsgenossenschaft

- Sozialamt

- Klinik

- Einrichtung

- Patient als Selbstzahler

- Angehörige

- private Versicherung

- sonstige Stelle

Der Kostenträger beantwortet die Frage:

Wer trägt die Kosten?

Der Kostenträger ist nicht automatisch:

- Auftraggeber

- Patient

- Rechnungsempfänger

- Kunde

Diese Begriffe müssen getrennt bleiben.

---

# Teil N – Auftraggeber

Der Auftraggeber ist die Person oder Organisation, die eine Fahrt beauftragt oder anfragt.

Mögliche Auftraggeber:

- Patient

- Angehöriger

- Klinik

- Arztpraxis

- Pflegeheim

- Krankenkasse

- Disponent

- Vermittler

- sonstige Einrichtung

Der Auftraggeber beantwortet die Frage:

Wer hat die Fahrt beauftragt oder ausgelöst?

Der Auftraggeber ist nicht automatisch der Kostenträger.

Der Auftraggeber ist nicht automatisch der Rechnungsempfänger.

Ein Auftrag kann fachlich haben:

- Patient

- Auftraggeber

- Kostenträger

- Rechnungsempfänger

Diese können identisch sein, müssen es aber nicht.

---

# Teil O – Auftrag

Der Auftrag ist der zentrale Geschäftsprozess.

## Hinweis zum aktuellen Stand

In der aktuellen App ist der Auftrag auch die zentrale operative Durchführungseinheit.

Fahrer, Fahrzeug, Status, Zeiten und Abrechnungsinformationen können aktuell direkt am Auftrag hängen.

Die spätere Trennung zwischen Auftrag und Fahrt ist ein Zielmodell und kein sofortiger Umbauauftrag.

## Fachliche Bedeutung

Ein Auftrag beschreibt, dass eine Beförderungsleistung geplant, durchgeführt, abgerechnet oder dokumentiert werden soll.

Ein Auftrag kann enthalten:

- Patient

- Auftraggeber

- Kostenträger

- Rechnungsempfänger

- Abholadresse

- Zieladresse

- Termin

- Transportart

- Mobilität

- Fahrer

- Fahrzeug

- Status

- Preis

- Abrechnungsstatus

- Dokumente

- Notizen

- Kommunikation

- Aktivitätsverlauf

- Risiken

- KI-Hinweise

Aktuell darf GHASI AI den Auftrag als operative Einheit behandeln.

Langfristig kann ein Auftrag mehrere Fahrten enthalten.

Beispiel langfristig:

- Ein Dauerauftrag für Dialyse

- mehrere einzelne Fahrten

- jede Fahrt mit eigenem Datum, Fahrer, Fahrzeug, Status

- eine oder mehrere Rechnungen

Das ist Zielmodell, nicht Sofort-Umbau.

---

# Teil P – Fahrt

## Hinweis

Das Fahrt-Objekt beschreibt das langfristige Zielmodell.

Aktuell kann die Fahrtlogik noch direkt im Auftrag enthalten sein.

Ein eigenständiges Fahrt-Objekt darf erst eingeführt werden, wenn dies separat geplant und freigegeben wurde.

## Langfristige Bedeutung

Eine Fahrt beschreibt die konkrete operative Durchführung einer Beförderung.

Eine Fahrt kann langfristig enthalten:

- Auftrag

- Patient

- Fahrer

- Fahrzeug

- Abholzeit

- Zielzeit

- tatsächlicher Start

- tatsächliche Ankunft

- Status

- GPS-Verlauf

- Kilometer

- Wartezeit

- Abbruchgrund

- Fahrerkommentar

- Patient abgeholt

- Patient angekommen

- besondere Vorkommnisse

Langfristige Beziehung:

Ein Auftrag kann eine oder mehrere Fahrten enthalten.

Eine Fahrt gehört zu genau einem Auftrag.

Aktueller Stand:

Diese Trennung existiert noch nicht als vollständiges eigenes operatives Objekt.

Deshalb darf kein Prompt automatisch eine `fahrten`-Tabelle, Fahrt-Seite oder Migrationslogik daraus ableiten.

---

# Teil Q – Dauerauftrag

Ein Dauerauftrag beschreibt eine wiederkehrende Beförderungslogik.

Ein Dauerauftrag kann enthalten:

- Patient

- Wochentage

- Uhrzeiten

- Zeitraum

- Transportart

- wiederkehrende Abholadresse

- wiederkehrende Zieladresse

- Kostenträger

- Genehmigung

- Verordnung

- besondere Hinweise

Aktuell kann ein Dauerauftrag technisch eigenständig oder als wiederkehrende Auftragslogik umgesetzt sein.

Langfristig kann ein Dauerauftrag einzelne Aufträge oder Fahrten erzeugen.

Die Erzeugung einzelner Fahrten aus Daueraufträgen ist ein sensibler Prozess und darf nicht ohne klare Regeln automatisiert werden.

---

# Teil R – Tour

Eine Tour ist eine operative Bündelung mehrerer Aufträge oder Fahrten.

Eine Tour kann relevant sein für:

- Fahrerplanung

- Routenplanung

- Zeitoptimierung

- Fahrzeugauslastung

- Live-Status

- Tagesübersicht

Aktuell kann Tourlogik auch über Auftragslisten, Fahreransichten oder Dispositionsansichten abgebildet sein.

Eine eigene Tour-Struktur ist ein mögliches Zielmodell, aber kein automatischer Sofort-Umbau.

---

# Teil S – Fahrer

Ein Fahrer ist eine operative Person, die Fahrten durchführt.

Ein Fahrer kann verbunden sein mit:

- Benutzerkonto

- Rolle Fahrer

- Fahrzeug

- Aufträgen

- Schichten

- Qualifikationen

- Dokumenten

- Verfügbarkeit

- Status

- Telefonnummer

- Fahrer-App

- GPS-Freigabe

- Aktivitätsprotokoll

Ein Fahrer ist nicht automatisch ein Benutzer, auch wenn er meistens ein Benutzerkonto haben kann.

Ein Fahrer darf nur eigene operative Informationen sehen.

Fahrer dürfen keine fremden Patientendaten sehen, außer sie sind für die eigene Fahrt erforderlich.

---

# Teil T – Fahrzeug

Ein Fahrzeug ist ein Betriebsmittel zur Durchführung von Krankenfahrten.

Ein Fahrzeug kann enthalten:

- Kennzeichen

- Fahrzeugtyp

- Sitzplätze

- Rollstuhlfähigkeit

- Tragestuhlfähigkeit

- liegende Beförderung, falls zulässig

- Status

- Fahrerzuordnung

- Versicherung

- Leasingvertrag

- TÜV

- Wartung

- Kilometerstand

- Standort

- GPS-Position

- letzte echte GPS-Meldung

- Dokumente

- Kosten

- Einnahmenbezug

Ein Fahrzeug ist nicht nur Stammdatenobjekt.

Ein Fahrzeug ist relevant für:

- Disposition

- Kostenrechnung

- Compliance

- Wartung

- Investitionsentscheidungen

- Gewinnanalyse

- Ausfallrisiken

---

# Teil U – GPS und Standort

GPS-Daten beschreiben den Standort eines Fahrzeugs oder Fahrers.

GPS-Daten sind sensibel.

GPS darf nur verwendet werden, wenn:

- der Fahrer aktiv zustimmt

- die Funktion sichtbar ist

- keine heimliche Hintergrundverfolgung stattfindet

- der Zweck klar ist

- die Daten nur für operative Zwecke genutzt werden

Aktuelle GPS-Logik kann echte und simulierte Positionen unterscheiden.

Echte GPS-Daten müssen als echt erkennbar sein.

Simulierte GPS-Daten müssen als simuliert erkennbar sein.

GHASI AI darf simulierte Daten niemals als echte Standortdaten darstellen.

---

# Teil V – Rechnung

Eine Rechnung beschreibt eine Forderung gegenüber einem Rechnungsempfänger.

Eine Rechnung kann verbunden sein mit:

- Auftrag

- Patient

- Kostenträger

- Rechnungsempfänger

- Kunde

- Preis

- Leistungsdatum

- Rechnungsdatum

- Fälligkeit

- Status

- Zahlung

- Mahnung

- Dokument

- Aktivitätsprotokoll

- Änderungsverlauf

Eine Rechnung ist nicht der Auftrag.

Eine Rechnung ist nicht die Zahlung.

Eine Rechnung ist nicht automatisch ein Vertrag.

Eine Rechnung kann aktuell mit einfachen Beträgen arbeiten.

Langfristig kann eine Rechnung aus strukturierten Rechnungspositionen bestehen.

---

# Teil W – Rechnungsposition

## Hinweis

Rechnungspositionen sind ein langfristiges Zielmodell für eine sauberere und detailliertere Abrechnung.

Aktuell können Rechnungen noch mit einfachen Beträgen arbeiten.

Die Einführung echter Rechnungspositionen ist ein späterer Ausbau und kein sofortiger Umbauauftrag.

## Langfristige Bedeutung

Eine Rechnungsposition beschreibt eine einzelne abrechenbare Leistung innerhalb einer Rechnung.

Eine Rechnungsposition kann langfristig enthalten:

- Leistungsart

- Bezug zu Auftrag oder Fahrt

- Datum

- Menge

- Einheit

- Einzelpreis

- Gesamtpreis

- Steuerhinweis

- Zuschlag

- Wartezeit

- Kilometer

- Eigenanteil

- Kostenträgeranteil

Eine Rechnung kann mehrere Rechnungspositionen enthalten.

Aktuell darf GHASI AI nicht automatisch davon ausgehen, dass eine solche Struktur bereits vollständig existiert.

---

# Teil X – Rechnungsempfänger

Der Rechnungsempfänger ist die Person oder Organisation, an die eine Rechnung gestellt wird.

Der Rechnungsempfänger beantwortet die Frage:

An wen geht die Rechnung?

Der Rechnungsempfänger kann sein:

- Krankenkasse

- Patient

- Angehöriger

- Einrichtung

- Unternehmen

- Sozialleistungsträger

- private Versicherung

- sonstige Stelle

Der Rechnungsempfänger ist nicht automatisch:

- Patient

- Auftraggeber

- Kostenträger

Diese Trennung ist fachlich wichtig.

Fehlerhafte Gleichsetzung kann zu falscher Abrechnung führen.

---

# Teil Y – Zahlung

Eine Zahlung beschreibt einen Zahlungseingang oder Zahlungsvorgang zu einer Rechnung.

Eine Zahlung kann enthalten:

- Rechnung

- Datum

- Betrag

- Zahlungsart

- Bankreferenz

- Notiz

- Importquelle

- Zuordnungssicherheit

- Benutzer, der die Zahlung verbucht hat

Eine Zahlung ist nicht die Rechnung.

Eine Rechnung kann mehrere Zahlungen haben.

Teilzahlungen müssen möglich sein.

Überzahlungen oder nicht zuordenbare Zahlungen müssen als Risiko markiert werden.

Bankimport darf Zahlungen vorschlagen, aber nicht ungeprüft endgültig verbuchen, wenn Unsicherheit besteht.

---

# Teil Z – Mahnung

Eine Mahnung ist eine Folgeaktion zu einer offenen Rechnung.

Eine Mahnung kann enthalten:

- Rechnung

- Mahnstufe

- Datum

- Frist

- Text

- Empfänger

- Status

- Versandart

- Freigabe durch Benutzer

GHASI AI darf Mahnungen vorbereiten.

GHASI AI darf Mahnungen nicht ohne Freigabe versenden.

---

# Teil AA – Ausgabe

Eine Ausgabe beschreibt Kosten des Unternehmens.

Ausgaben können sein:

- Fahrzeugkosten

- Diesel oder Strom

- Versicherung

- Leasing

- Wartung

- Reparatur

- Lohn

- Büro

- Software

- Steuerberater

- Gebühren

- Sonstige Betriebsausgaben

Ausgaben sind relevant für:

- Gewinnanalyse

- Fahrzeugrentabilität

- Liquidität

- Steuerübersicht

- Investitionsentscheidungen

Eine Ausgabe darf nicht mit einer Zahlung auf Rechnung verwechselt werden.

---

# Teil AB – Lohn und Personal

Lohn und Personal betreffen Mitarbeiter, Fahrer und Beschäftigungsverhältnisse.

Relevante Themen:

- Arbeitszeit

- Schicht

- Minijob

- Vollzeit

- Sozialversicherung

- ELStAM

- Lohnkonto

- Urlaub

- Krankheit

- Qualifikationen

- Dokumente

- Fristen

GHASI AI darf Hinweise geben.

GHASI AI ersetzt keine Lohnbuchhaltung, keinen Steuerberater und keine Rechtsberatung.

---

# Teil AC – Schicht

Eine Schicht beschreibt geplante Arbeitszeit.

Eine Schicht kann verbunden sein mit:

- Fahrer

- Datum

- Startzeit

- Endzeit

- Fahrzeug

- Verfügbarkeit

- Aufträgen

- Pausen

- Konflikten

Schichtplanung beeinflusst Disposition.

Doppelbuchungen, Überschneidungen und fehlende Fahrer müssen erkennbar sein.

---

# Teil AD – Einrichtung

Eine Einrichtung ist eine Organisation, die mit Fahrten verbunden sein kann.

Beispiele:

- Krankenhaus

- Dialysezentrum

- Arztpraxis

- Pflegeheim

- Therapiezentrum

- Reha

- Klinik

- Wohnheim

Eine Einrichtung kann sein:

- Abholort

- Zielort

- Auftraggeber

- Rechnungsempfänger

- Vertragspartner

- Kontaktstelle

Eine Einrichtung ist nicht automatisch Patient.

Eine Einrichtung ist nicht automatisch Kostenträger.

---

# Teil AE – Kunde

Ein Kunde ist eine fachliche Geschäftsbeziehung.

Ein Kunde kann sein:

- Einrichtung

- Krankenkasse

- Unternehmen

- Privatperson

- Vermittler

- sonstiger Auftraggeber

Kunde ist ein kaufmännischer Begriff.

Kunde darf nicht automatisch mit Patient gleichgesetzt werden.

---

# Teil AF – Vertrag

Ein Vertrag beschreibt eine verbindliche geschäftliche oder abrechnungsrelevante Vereinbarung.

Verträge können bestehen mit:

- Krankenkassen

- Einrichtungen

- Vermittlern

- Leasinggebern

- Versicherungen

- Softwareanbietern

- Dienstleistern

Ein Vertrag kann enthalten:

- Vertragspartner

- Beginn

- Ende

- Kündigungsfrist

- Preise

- Pflichten

- Dokumente

- Risiken

- Fristen

- Status

Verträge sind Grundlage für Warnungen und Entscheidungen.

---

# Teil AG – Preisvereinbarung

Eine Preisvereinbarung beschreibt, welche Preise für welche Leistungen gelten.

Preisvereinbarungen können abhängig sein von:

- Kostenträger

- Vertrag

- Transportart

- Strecke

- Kilometer

- Pauschale

- Wartezeit

- Zuschlägen

- Genehmigung

- Zeitraum

Preise dürfen nicht erfunden werden.

Wenn Preisgrundlagen fehlen, muss GHASI AI dies melden.

Schätzungen müssen als Schätzungen gekennzeichnet werden.

---

# Teil AH – Dokument

Ein Dokument ist ein gespeicherter Nachweis oder eine Datei.

Dokumente können sein:

- Verordnung

- Genehmigung

- Rechnung

- Vertrag

- Fahrzeugschein

- Versicherung

- TÜV

- Führerschein

- P-Schein

- Arbeitsvertrag

- Krankenkassenunterlage

- Schriftverkehr

Ein Dokument muss einen fachlichen Bezug haben.

Mögliche Bezüge:

- Patient

- Auftrag

- Rechnung

- Fahrer

- Fahrzeug

- Vertrag

- Einrichtung

- Kostenträger

Ein Dokument ohne Bezug ist fachlich schwach.

Langfristig soll jedes Dokument eindeutig verknüpft sein.

---

# Teil AI – GHASI-AI-Empfehlung

## Hinweis

GHASI-AI-Empfehlungen als gespeicherte Objekte sind ein langfristiges Zielmodell.

Aktuell können KI-Hinweise auch flüchtig berechnet oder direkt in der Oberfläche angezeigt werden.

Die dauerhafte Speicherung als eigenes Objekt mit Status und Verlauf ist ein späterer Ausbau.

## Langfristige Bedeutung

Eine GHASI-AI-Empfehlung beschreibt eine konkrete, nachvollziehbare Empfehlung der KI.

Eine Empfehlung kann langfristig enthalten:

- Anlass

- betroffene Objekte

- Datenbasis

- Begründung

- Risiko

- erwarteter Nutzen

- Priorität

- Status

- Entscheidung des Unternehmers

- Datum

- Verlauf

Status einer Empfehlung könnte langfristig sein:

- vorgeschlagen

- gesehen

- angenommen

- abgelehnt

- umgesetzt

- erledigt

- archiviert

GHASI AI darf Empfehlungen geben.

GHASI AI darf Empfehlungen nicht ohne Freigabe selbst umsetzen.

---

# Teil AJ – GHASI-AI-Hinweis

Ein GHASI-AI-Hinweis ist eine Warnung, Erklärung oder Beobachtung.

Ein Hinweis kann sein:

- fehlende Verordnung

- offene Rechnung

- unklare Mobilität

- fehlender Fahrer

- Fahrzeugausfall

- Frist läuft ab

- Zahlung überfällig

- Preisgrundlage fehlt

- möglicher Abrechnungsfehler

- Risiko in Vertrag

- ungewöhnliche Kostenentwicklung

Ein Hinweis kann aktuell berechnet oder angezeigt werden.

Ein Hinweis muss nicht automatisch als gespeichertes Objekt existieren.

---

# Teil AK – KI-Gedächtnis

Das KI-Gedächtnis speichert langfristig relevante bestätigte Informationen.

Es speichert nicht automatisch alle Rohdaten.

Rohdaten gehören in die jeweiligen Fachobjekte.

Das KI-Gedächtnis darf speichern:

- bestätigte Unternehmer-Präferenzen

- langfristige Ziele

- wichtige Entscheidungen

- wiederkehrende Regeln

- projektbezogene Grundsätze

- ausdrücklich bestätigte Erinnerungen

Das KI-Gedächtnis darf nicht ungeprüft speichern:

- zufällige Chat-Aussagen

- medizinische Rohdaten

- unbestätigte Annahmen

- doppelte Kopien von Tabelleninhalten

- sensible Informationen ohne Zweck

---

# Teil AL – Kommunikation

Kommunikation umfasst Nachrichten, Telefonnotizen, E-Mails, Briefe oder interne Notizen.

Kommunikation kann verbunden sein mit:

- Patient

- Auftrag

- Rechnung

- Krankenkasse

- Einrichtung

- Fahrer

- Vertrag

- Mahnung

GHASI AI darf Kommunikation vorbereiten.

GHASI AI darf keine Kommunikation ohne Freigabe versenden, wenn sie geschäftlich, rechtlich oder abrechnungsrelevant ist.

---

# Teil AM – Aktivität

Eine Aktivität beschreibt, was im System passiert ist.

Aktivitäten beantworten:

- Wer hat etwas getan?

- Wann wurde es getan?

- Was wurde geändert?

- Welches Objekt war betroffen?

- Warum ist es relevant?

Aktivitäten sind wichtig für:

- Nachvollziehbarkeit

- Sicherheit

- Fehlerklärung

- Abrechnung

- interne Kontrolle

Aktivitäten dürfen nicht als zweite Datenquelle für Stammdaten missbraucht werden.

Sie dokumentieren Änderungen, ersetzen aber nicht das Fachobjekt.

---

# Teil AN – Compliance-Frist

Eine Compliance-Frist beschreibt eine wichtige Frist oder Pflicht.

Beispiele:

- TÜV

- Versicherung

- P-Schein

- Führerscheinprüfung

- Vertrag läuft aus

- Kündigungsfrist

- Genehmigung läuft ab

- Zuzahlungsbefreiung läuft ab

- Verordnung oder Genehmigung fehlt

- Zahlungsfrist

- Mahnfrist

Compliance-Fristen müssen mit dem betroffenen Objekt verbunden sein.

Eine Frist ohne Bezug ist fachlich unvollständig.

---

# Teil AO – Keine doppelte Wahrheit

GHASI AI darf keine doppelte Wahrheit erzeugen.

Verbotene Muster:

- Patientendaten zusätzlich dauerhaft im Auftrag als zweite Wahrheit pflegen

- Fahrzeugstatus an mehreren Stellen unterschiedlich speichern

- Zahlungsstatus unabhängig von Zahlungen manuell widersprüchlich setzen

- Krankenkasse als Text speichern, obwohl ein Kostenträgerobjekt existiert, ohne klaren Übergangsgrund

- GPS simuliert anzeigen, ohne es als simuliert zu kennzeichnen

- KI-Schätzung als echte Unternehmenszahl speichern

- Auftraggeber, Kostenträger und Rechnungsempfänger vermischen

- Zielmodell-Objekte so darstellen, als seien sie bereits technisch umgesetzt

Erlaubte Muster:

- Daten anzeigen

- Daten verlinken

- Daten berechnen

- Daten cachen, wenn klar ist, dass der Cache keine Wahrheit ist

- historische Schnappschüsse speichern, wenn sie ausdrücklich als Historie markiert sind

---

# Teil AP – Statuslogik

Statuswerte müssen fachlich eindeutig sein.

Ein Status darf nicht nur optische Bedeutung haben.

Status beeinflusst:

- Sichtbarkeit

- Folgeaktionen

- Warnungen

- Abrechnung

- Fahreransicht

- Disposition

- Auswertungen

Beispiel Auftrag:

- geplant

- zugewiesen

- angenommen

- unterwegs

- Patient aufgenommen

- abgeschlossen

- storniert

Aktuelle App-Statuswerte können davon abweichen.

Das Domain Model beschreibt die fachliche Logik.

Technische Anpassungen dürfen nur geplant erfolgen.

---

# Teil AQ – Risiko

Ein Risiko ist eine erkennbare mögliche Gefahr für Betrieb, Geld, Recht, Qualität oder Sicherheit.

Risiken können entstehen durch:

- fehlende Dokumente

- falsche Abrechnung

- fehlende Genehmigung

- falscher Kostenträger

- falscher Rechnungsempfänger

- Fahrzeugausfall

- Fahrer fehlt

- überfällige Zahlung

- Fristversäumnis

- unklare Vertragslage

- rechtlich unsichere Transportart

- unvollständige Patientendaten

GHASI AI soll Risiken früh erkennen und erklären.

GHASI AI darf Risiken nicht verschweigen, nur weil eine Funktion technisch möglich ist.

---

# Teil AR – Warnung

Eine Warnung ist ein konkreter Hinweis auf ein Risiko oder eine fehlende Voraussetzung.

Warnungen sollen:

- verständlich sein

- den Grund nennen

- das betroffene Objekt verlinken

- eine Handlung vorschlagen

- nicht übertreiben

- nicht erfunden sein

Warnungen dürfen nicht zu automatischen Entscheidungen werden.

---

# Teil AS – Kennzahl

Eine Kennzahl ist eine berechnete Unternehmensinformation.

Beispiele:

- Umsatz

- offene Forderungen

- Gewinn

- Fahrzeugkosten

- Umsatz pro Fahrzeug

- Umsatz pro Fahrer

- Auslastung

- Kosten pro Kilometer

- offene Rechnungen

- Mahnquote

- Liquidität

- Auftragsvolumen

- Stornoquote

Kennzahlen müssen eine klare Datenbasis haben.

Wenn Daten fehlen, muss die Kennzahl als unvollständig oder geschätzt markiert werden.

GHASI AI darf keine Kennzahlen erfinden.

---

# Teil AT – Marktquelle

Eine Marktquelle ist eine externe Informationsquelle.

Beispiele:

- Vermittlerplattform

- Ausschreibung

- Krankenkasseninformation

- Behördeninformation

- Branchenportal

- öffentliche Webseite

- Partnerportal

- E-Mail-Angebot

Marktquellen gehören zum Denkbereich „Welt“.

GHASI AI darf Marktinformationen analysieren.

GHASI AI darf externe Angebote nicht automatisch annehmen.

GHASI AI darf externe Nachrichten nicht automatisch versenden.

Rechtliche und technische Grenzen externer Quellen müssen beachtet werden.

---

# Teil AU – Integration

Eine Integration verbindet GHASI AI mit einem externen System.

Beispiele:

- Google Maps

- Kalender

- E-Mail

- Buchhaltung

- Abrechnungssystem

- Dokumentenspeicher

- Vermittlerplattform

- Zahlungsimport

- Telematik

Jede Integration braucht:

- Zweck

- Datenfluss

- Berechtigungen

- Fehlerverhalten

- Protokollierung

- Datenschutzprüfung

- Fallback

- Freigabe

Keine Integration darf heimlich Daten übertragen.

Keine Integration darf ohne Freigabe geschäftliche Aktionen ausführen.

---

# Teil AV – Grenzen des Domain Models

Dieses Domain Model ist eine fachliche Grundlage.

Es ist keine automatische Aufgabenliste.

Es ist keine automatische Datenbankplanung.

Es ist keine automatische UI-Planung.

Es ist keine automatische Migrationsanweisung.

Zielmodell-Objekte dürfen nicht automatisch zu Sofort-Aufgaben werden.

Wenn ein Objekt im Domain Model beschrieben ist, bedeutet das nicht automatisch, dass es sofort technisch umgesetzt werden muss.

Bei großen Zielmodell-Objekten wie Fahrt, Rechnungsposition oder GHASI-AI-Empfehlung muss zuerst geprüft werden:

- aktueller App-Zustand

- betroffene Tabellen

- betroffene Seiten

- Auswirkungen auf Fahrer-App

- Auswirkungen auf Disposition

- Auswirkungen auf Rechnungen

- Auswirkungen auf GPS und Statuslogik

- Migrationsrisiko

- Aufwand

- Nutzen

- Freigabe durch den Unternehmer

Falls andere Dokumente wie Roadmap oder Implementation Guide später auf Fahrt, Rechnungsposition oder GHASI-AI-Empfehlung verweisen, müssen diese Begriffe ebenfalls als Zielmodell verstanden werden, solange keine separate Freigabe zur technischen Umsetzung erfolgt ist.

Große Umbauten dürfen nicht aus diesem Dokument allein abgeleitet werden.

GHASI AI soll zuerst stabilisieren, verbinden und absichern, bevor Zielmodell-Objekte technisch eingeführt werden.

---

# Schlussprinzip

GHASI AI entwickelt kein loses Modul-System.

GHASI AI entwickelt ein intelligentes Unternehmen.

Dieses Domain Model schützt das Projekt davor, Begriffe zu vermischen, Zielvisionen zu früh technisch umzubauen oder bestehende funktionierende App-Logik unnötig zu zerstören.

Fachliche Klarheit kommt vor technischer Geschwindigkeit.
