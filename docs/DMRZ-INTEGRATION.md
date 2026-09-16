# DMRZ-Integration in GHASI

Stand: 15.09.2026

## Ziel und Grenze

GHASI bereitet interne Betriebs- und Abrechnungsdaten für DMRZ vor, damit Doppeleingaben reduziert werden. DMRZ bleibt das Abrechnungssystem. GHASI baut DMRZ nicht nach und erfindet keine Schnittstellenfelder, Preise, Codes oder Endpunkte.

## Öffentlich verifiziert

DMRZ beschreibt öffentlich den Import abrechnungsrelevanter Daten aus Branchensoftware, DTA-Schnittstellen sowie CSV-/CON-Importe. Für individuellen CSV-Rechnungsimport nennt DMRZ ausdrücklich eigene Vorgaben bzw. eine technische Anlage, die bereitgestellt wird.

Öffentliche Quellen (geprüft 15.09.2026):

- https://www.dmrz.de/abrechnung/schnittstellen
- https://www.dmrz.de/wissen/ratgeber/informationen-fuer-softwarehaeuser
- https://www.dmrz.de/wissen/ratgeber/so-einfach-lassen-sich-daten-ins-dmrz-system-ueberfuehren
- https://www.dmrz.de/fileadmin/Leistungsbeschreibung_Krankentransport_Tarife.pdf

Die öffentlich zugänglichen Informationen enthalten nicht die vollständige technische Feld-/Formatbeschreibung für eine produktive GHASI-Anbindung.

## Vor produktiver Anbindung noch erforderlich

1. Vollständige offizielle technische Anlage/Schnittstellenbeschreibung für den konkreten Krankenfahrten-/Krankentransport-Import.
2. Bestätigte Spezifikationsversion und Übertragungsweg für HERZmedV.
3. Benötigte Zugangsdaten bzw. Freischaltungen – ohne Werte im Repository.
4. Offizielle Test-/Sandbox-/Abnahmeumgebung oder dokumentiertes Abnahmeverfahren.
5. Verbindliches Feldmapping inklusive Pflichtfeldern, Datentypen, Codes und Idempotenzschlüsseln.
6. Fehler-, Rücklauf-, Korrektur- und Wiederholungsregeln.
7. Fachliche Zuordnung von GHASI-Fahrt-/Verordnungsdaten zu DMRZ-Feldern, durch HERZmedV/DMRZ bestätigt.
8. Datenschutz-/AV-/Berechtigungsvorgaben für die Übertragung.
9. Menschliche Unternehmerfreigabe vor jeder bindenden Übertragung.

## Bis dahin erlaubt

- interne Fahrtdaten auf Vollständigkeit prüfen;
- interne, nicht übertragbare Abrechnungsentwürfe vorbereiten;
- fehlende oder widersprüchliche Angaben markieren;
- synthetische Mapping-/Validierungstests vorbereiten.

## Bis dahin gesperrt

- echte Übertragung an DMRZ;
- erfundene DMRZ-Feldnamen, Codes, Preise oder Endpunkte;
- automatische Vertrags-/Preisentscheidung;
- automatische endgültige Abrechnung;
- externe Übermittlung ohne bestätigte Spezifikation und menschliche Freigabe.

Code-Status: `DMRZ_INTEGRATION_STATUS = "spezifikation_ausstehend"`. Dieser Status bleibt bis zu einer echten, erfolgreich getesteten DMRZ-Anbindung bestehen.
