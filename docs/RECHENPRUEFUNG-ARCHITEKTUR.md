# GHASI AI – Rechenprüfung und Vergleichsarchitektur

Prüfstichtag: 14.09.2026

## Grundregel

GHASI kopiert keine geheimen oder proprietären Rechenmaschinen. Die produktive
Berechnung ist deterministischer Code. KI-Prüfer dürfen Quellen recherchieren,
synthetische Fälle vergleichen, Abweichungen erklären und neue Tests vorschlagen.
Sie dürfen keine Werte, Verträge, DMRZ-Felder oder Formeln erfinden.

Vertrauensreihenfolge:

1. **A_AMTLICH** – Gesetz, Verordnung, amtlicher Programmablaufplan oder Träger.
2. **B_HERSTELLER** – öffentlich dokumentiertes Verhalten eines Herstellers.
3. **C_BLACKBOX** – Ergebnisvergleich mit identischen synthetischen Eingaben.

Bei einem Widerspruch zu A wird nicht nach Mehrheitsprinzip entschieden. Der Fall
wird blockiert oder als Abweichung markiert und fachlich geklärt.

## Goldene Testfälle

Jeder Rechenkern erhält reproduzierbare Fälle mit festem Stichtag, Eingaben,
erwartetem Ergebnis, Quelle, Rundungsregel und Toleranz. Änderungen an Formeln
müssen diese Fälle erneut bestehen. Gesetzeswechsel werden als neue Version mit
eigenem Gültigkeitszeitraum modelliert, nicht durch Überschreiben historischer Werte.
## Vergleichssysteme

Je nach Fachgebiet werden insbesondere folgende Systeme als Gegenprüfung geführt:
BMF-Rechner/PAP, Minijob-Zentrale, Deutsche Rentenversicherung, AOK-Rechner,
WISO, DATEV, Lexware, smartsteuer, KoSIT, DMRZ und opta data.

Ein Herstellername in der Vergleichsliste bedeutet nicht, dass GHASI dessen
internen Quellcode kennt oder kopiert. Herstellervergleiche werden erst als
C_BLACKBOX gewertet, wenn derselbe synthetische Fall tatsächlich dort gerechnet
und das Ergebnis dokumentiert wurde.

## Fail-closed

- Lohnsteuer: keine Aussage „exakt“, bis der vollständige BMF-PAP 2026 umgesetzt
  und mit amtlichen/Black-Box-Fällen gegengeprüft ist.
- DMRZ: keine produktive Übertragung ohne vollständige offizielle technische
  Spezifikation und konkrete menschliche Unternehmerfreigabe.
- XRechnung: kein produktiver Versand ohne KoSIT-Validierung.
- Umsatzsteuer § 4 Nr. 17b: keine automatische Befreiung allein aus Fahrtzweck
  oder Transportart; konkrete Voraussetzungen müssen bestätigt sein.
- Kassenpreise: kein Preis ohne gültigen, freigegebenen Vertrag.

## Bereits amtlich gehärtet

- Einkommensteuertarif 2026: § 32a EStG inkl. Abrundung auf volle Euro.
- Soli 2026: 20.350/40.700 EUR Freigrenzen und 11,9-%-Milderungszone.
- Minijob 2026: 603 EUR und amtliche Pauschal-/Umlagesätze.
- Midijob 2026: 603,01–2.000 EUR, Faktor F=0,6619 und DRV-Bemessungsformeln.
