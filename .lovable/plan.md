# Plan: Fehler, Seiten-Konsolidierung & Steuermodul

## 1. Gefundene Fehler & Schwachstellen

Harte Build-Fehler gibt es keine (`tsgo` sauber, Supabase-Linter sauber, keine Runtime-Fehler). Die Befunde betreffen Korrektheit, Konsistenz und Struktur:

**Steuer/USt (kritisch für Punkt 3)**
- `src/lib/invoices.functions.ts` (`abrechnungsartFuer`) vergibt fest **7 % für Krankenkasse** und **19 % für Kunde/Patient**. Für Krankentransporte ist das falsch – diese sind nach **§4 Nr.17b UStG steuerfrei (0 %)**. Ein reiner Krankenfahrdienst weist gar keine USt aus.
- `src/lib/finance.ts`: die Seed-Rechnungen tragen ebenfalls 7 %/19 %, und `netto()`/`mwstBetrag()` rechnen den Betrag als **Brutto inkl. USt** zurück – bei einem steuerbefreiten Betrieb erzeugt das falsche Netto-/USt-Ausweise.
- Kein gesetzlicher Hinweistext auf Rechnungen, kein konfigurierbarer USt-Modus.

**Konsistenz / Daten**
- `src/routes/einstellungen.tsx` speichert Firmendaten **nur in localStorage** (nicht serverseitig lesbar) und hat als Default **„GmbH“ + Berliner Adresse** – passt nicht zum Einzelunternehmen in Minden. Serverfunktionen (Rechnungsentwürfe) können diese Config daher nicht lesen.
- Die vom dir genannte Route **`einrichtungen` existiert nicht** – vorhanden sind `krankenhaeuser`, `dialysezentren`, `pflegeheime` (gemeinsames `EinrichtungModul`) sowie das separat implementierte `kunden`.
- Inhaltliche **Redundanz** zwischen Dashboard, `control-center`, `ceo-cockpit` (KPIs, Health Score, KI-Analyse dreifach) und zwischen `insights`/`prognosen`/`statistiken`/`berichte`.

Sonst: Navigation zeigt auf existierende Routen (keine toten Links), RLS/Reads wurden bereits abgesichert.

## 2. Vorschlag Seiten-Konsolidierung

### 2a. Reporting/Analyse — von 7 auf 2 Seiten
Zusammenführung in einen **Analyse-Hub mit Tabs** statt vieler Einzelseiten:

```text
CEO Cockpit  (/ceo-cockpit)   ← Flaggschiff mit internen Tabs:
  • Cockpit      (bisher ceo-cockpit + control-center)
  • Prognosen    (bisher prognosen)
  • Insights     (bisher insights)
  • Statistiken  (bisher statistiken)
  • Berichte     (bisher berichte, inkl. Export)
Alert-Center (/warnungen)     ← bleibt eigenständig (Warnungen)
```
- `control-center` geht im Cockpit-Tab auf (KPIs/Health bereits doppelt).
- `aktions-center` (KI-Nachrichten-Entwürfe) ist inhaltlich **Kommunikation**, nicht Analyse → verschieben in `Posteingang` als Tab „Entwürfe“ (oder unter „Kommunikation“ belassen).
- Alte Routen bleiben als **Redirects** auf die passenden Tabs, damit keine Links/Bookmarks brechen.
- Navigation: Gruppe „Übersicht“ wird schlanker (Dashboard, CEO Cockpit, Alert-Center, KI-Assistent, Aktivitäten).

### 2b. Einrichtungen — von 3(+1) auf 1(+1)
- Eine Route **`/einrichtungen`** mit Tabs **Alle · Krankenhäuser · Dialysezentren · Pflegeheime** (das `EinrichtungModul` kann bereits nach `typ` filtern – nur der Wrapper wird um eine Tab-Auswahl ergänzt).
- Alte Routen (`krankenhaeuser`, `dialysezentren`, `pflegeheime`) → Redirects mit vorgewähltem Tab.
- **`kunden`** bleibt eine eigene Seite (anderes Datenmodell: Auftraggeber/Kassen), aber in der Stammdaten-Gruppe direkt daneben. (Alternative auf Wunsch: als weiterer Tab „Auftraggeber“ integrieren.)

**Ergebnis:** keine verlorene Funktionalität; ~10 Einzelseiten werden zu 2 Hubs mit Tabs + Redirects.

## 3. Umsetzungsplan Steuer-/Rechnungsmodul

**Neues `src/lib/steuer.ts` (Single Source of Truth)**
- `SteuerModus = "befreit_4_17b" | "kleinunternehmer_19" | "regulaer_19"`, Default `befreit_4_17b`.
- Pro-Auftragsart-Override (`Transportart` → Modus/Satz), z. B. nicht-medizinische Fahrten regulär 19 %.
- `computeUst(betrag, modus)` → `{ netto, ust, satz, brutto, hinweis }` (steuerbefreit: Betrag = Netto = Brutto, USt 0).
- Gesetzliche Hinweistexte:
  - befreit: „Steuerfrei gemäß §4 Nr.17 Buchst. b UStG (Krankentransport).“
  - Kleinunternehmer: „Gemäß §19 UStG wird keine Umsatzsteuer berechnet.“
  - regulär: normaler USt-Ausweis 19 %.
- Gewerbesteuer-Konstanten Minden: **Hebesatz 460 %**, Steuermesszahl 3,5 %, Freibetrag 24.500 € (Einzelunternehmen); Helper `schaetzeGewinnNachSteuer(gewinn)` als **Referenzwert** (ESt bewusst nicht modelliert, Hinweis darauf).
- `STEUER_DISCLAIMER = "Diese Angaben ersetzen keine steuerliche Beratung."`

**Konfiguration & Persistenz**
- „Steuer-Einstellungen“-Bereich in `/einstellungen` (USt-Modus, Auftragsart-Overrides, Gewerbesteuer-Hebesatz mit Default 460, Unternehmensform).
- Speicherung über einen kleinen Store-Hook (`useSteuerConfig`), Default-Firmendaten auf Einzelunternehmen/Minden anpassen.
- Server-Defaults: `generateBillingDrafts` nutzt künftig **steuerfrei** für medizinische Transportarten und 19 % nur für explizit nicht-medizinische → korrigiert den 7 %/19 %-Fehler aus Punkt 1.

**Rechnungen**
- `src/lib/finance.ts`: `netto`/`mwstBetrag` und Seed-Sätze auf das Modus-Modell umstellen.
- `src/routes/rechnungen.tsx`: klare **Netto / USt / Brutto**-Ausweisung + Hinweistext je Modus + Disclaimer im Fußbereich.

**CEO Cockpit**
- Neue Kachel/Zeile **„Gewinn nach Steuern (Schätzung)“** basierend auf Gewerbesteuer (Hebesatz Minden 460 %) mit Begründung/Impact wie die übrigen CEO-Metriken, plus Disclaimer.

## Offene Annahmen (bitte ggf. korrigieren)
1. **Konsolidierung per Tabs + Redirects** (Routen nicht löschen). Falls du echtes Entfernen der Alt-Routen willst, sag Bescheid.
2. **`kunden` bleibt separat** (nicht als Einrichtungs-Tab).
3. **Steuer-Config in localStorage/Store** (wie bestehende Einstellungen), nicht als neue DB-Tabelle. Falls sie serverseitig/mehrbenutzerfähig persistiert werden soll, ergänze ich eine `company_settings`-Tabelle mit RLS.
4. Reihenfolge der Umsetzung: **Steuermodul zuerst** (höchster fachlicher Nutzen), dann Konsolidierung.

## Technische Notiz
- `SteuerModus`/Overrides zentral in `steuer.ts`; Verbraucher: `finance.ts`, `invoices.functions.ts`, `rechnungen.tsx`, `ceo-intelligence.ts`, `einstellungen.tsx`.
- Konsolidierung nutzt `Tabs` (shadcn) + `createFileRoute`-Redirects; `EinrichtungModul` erhält optionalen Tab-/`typ`-Filter im Wrapper. Keine Änderung an RLS/DB nötig (außer optional Annahme 3).
