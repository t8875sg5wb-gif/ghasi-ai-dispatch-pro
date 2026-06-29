// KI-Fahrer-/Fahrzeug-Empfehlung für unzugewiesene Aufträge.
//
// WICHTIG (Sicherheit): GHASI AI weist NIEMALS automatisch zu. Diese Funktion
// liefert ausschließlich einen Vorschlag (Fahrer, Fahrzeug, ETA, Begründung,
// Konfidenz, Alternativen). Die tatsächliche Zuweisung muss der Nutzer manuell
// bestätigen.

import {
  type Auftrag,
  effektiveMobilitaet,
  fahrzeugPasstZuMobilitaet,
  empfohlenerFahrzeugtyp,
} from "@/lib/auftraege";
import { type Fahrer, FAHRER_STATUS_META, istAbgelaufen } from "@/lib/fahrer";
import type { Fahrzeug } from "@/lib/fahrzeuge";
import { adresseStadt } from "@/lib/address";

export interface FahrerVorschlag {
  fahrer: Fahrer;
  fahrzeug: Fahrzeug | null;
  /** Kennzeichen (auch wenn Fahrzeugobjekt unbekannt). */
  fahrzeugKennzeichen: string | null;
  /** geschätzte Anfahrtszeit in Minuten */
  etaMin: number;
  score: number;
  /** Konfidenz 0–100 */
  konfidenz: number;
  begruendung: string;
  gruende: string[];
}

export interface VorschlagErgebnis {
  empfehlung: FahrerVorschlag | null;
  alternativen: FahrerVorschlag[];
}

/** Schicht "06:00 – 14:00" → liegt die Terminzeit darin? */
function inSchicht(schicht: string, termin: Date): boolean {
  const m = schicht.match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return true; // unbekannt → nicht bestrafen
  const von = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const bis = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
  const t = termin.getHours() * 60 + termin.getMinutes();
  return t >= von && t <= bis;
}

function findeFahrzeug(plate: string | null, vehicles: Fahrzeug[]): Fahrzeug | null {
  if (!plate) return null;
  return vehicles.find((v) => v.kennzeichen === plate) ?? null;
}

/** Bewertet einen Fahrer für einen konkreten Auftrag. */
function bewerteFuerAuftrag(
  fahrer: Fahrer,
  order: Auftrag,
  vehicles: Fahrzeug[],
  belegteFahrer: Map<string, number>,
): FahrerVorschlag | null {
  const meta = FAHRER_STATUS_META[fahrer.status];
  if (!meta.einsetzbar) return null;

  const gruende: string[] = [];
  let score = 0;

  // Verfügbarkeit
  if (fahrer.status === "verfuegbar") {
    score += 40;
    gruende.push("sofort verfügbar");
  } else if (fahrer.status === "pause") {
    score += 22;
    gruende.push("in Pause, bald einsetzbar");
  }

  // Bewertung & Pünktlichkeit
  score += fahrer.bewertung * 5;
  score += fahrer.puenktlichkeit * 0.15;

  // Nähe zum Abholort (Stadt-Heuristik, da keine Geocodierung)
  const stadtOrder = adresseStadt(order.abholort);
  const stadtFahrer = (fahrer.standort || "").toLowerCase();
  const naheBei = stadtOrder && stadtFahrer.includes(stadtOrder);
  if (naheBei) {
    score += 18;
    gruende.push(`nah am Abholort (${order.abholort.split(",")[0]})`);
  }

  // Fahrzeug-Eignung
  const mob = effektiveMobilitaet(order);
  let fahrzeug = findeFahrzeug(fahrer.fahrzeug, vehicles);
  let kennzeichen = fahrer.fahrzeug;

  if (fahrzeug) {
    const passt = fahrzeugPasstZuMobilitaet(mob, {
      rollstuhlGeeignet: fahrzeug.rollstuhlGeeignet,
      liegendGeeignet: fahrzeug.liegendGeeignet,
    });
    if (passt) {
      score += 20;
      gruende.push(`Fahrzeug ${fahrzeug.kennzeichen} passend für ${mob}`);
    } else {
      score -= 15;
      // Alternatives geeignetes, freies Fahrzeug suchen
      const ersatz = vehicles.find(
        (v) =>
          v.status === "frei" &&
          fahrzeugPasstZuMobilitaet(mob, {
            rollstuhlGeeignet: v.rollstuhlGeeignet,
            liegendGeeignet: v.liegendGeeignet,
          }),
      );
      if (ersatz) {
        fahrzeug = ersatz;
        kennzeichen = ersatz.kennzeichen;
        gruende.push(`Ersatzfahrzeug ${ersatz.kennzeichen} (${empfohlenerFahrzeugtyp(mob)})`);
      } else {
        gruende.push(`Achtung: kein passendes Fahrzeug für ${mob}`);
      }
    }
  } else if (vehicles.length > 0) {
    const passend = vehicles.find(
      (v) =>
        v.status === "frei" &&
        fahrzeugPasstZuMobilitaet(mob, {
          rollstuhlGeeignet: v.rollstuhlGeeignet,
          liegendGeeignet: v.liegendGeeignet,
        }),
    );
    if (passend) {
      fahrzeug = passend;
      kennzeichen = passend.kennzeichen;
      score += 8;
      gruende.push(`freies Fahrzeug ${passend.kennzeichen} verfügbar`);
    }
  }

  // Arbeitszeit / Schicht
  if (inSchicht(fahrer.schicht, new Date(order.termin))) {
    score += 8;
  } else {
    score -= 10;
    gruende.push("außerhalb der Schicht");
  }

  // Überstunden (faire Auslastung)
  score -= Math.min(fahrer.ueberstunden, 20) * 0.6;
  if (fahrer.ueberstunden <= 5) gruende.push("geringe Überstunden");

  // Qualifikation: abgelaufene Nachweise
  if (istAbgelaufen(fahrer.fuehrerschein.gueltigBis) || istAbgelaufen(fahrer.pSchein.gueltigBis)) {
    score -= 40;
    gruende.push("Nachweis abgelaufen – Vorsicht");
  }

  // Anschlussfahrt-Konflikt
  if ((belegteFahrer.get(fahrer.name) ?? 0) > 0) {
    score -= 12;
    gruende.push("hat bereits Anschlussfahrt");
  } else {
    gruende.push("keine kollidierende Anschlussfahrt");
  }

  // Beschwerden
  score -= fahrer.beschwerden * 4;

  // ETA-Schätzung (Heuristik)
  let eta = naheBei ? 10 : 25;
  if (fahrer.status === "pause") eta += 10;
  if (!naheBei && stadtOrder) eta += 5;

  const konfidenz = Math.max(5, Math.min(99, Math.round(score)));

  return {
    fahrer,
    fahrzeug,
    fahrzeugKennzeichen: kennzeichen,
    etaMin: eta,
    score: Math.round(score),
    konfidenz,
    begruendung: "",
    gruende: gruende.slice(0, 4),
  };
}

function baueBegruendung(v: FahrerVorschlag, order: Auftrag): string {
  const teile: string[] = [];
  const kfz = v.fahrzeugKennzeichen ?? "ohne Fahrzeug";
  teile.push(`Empfohlen: ${v.fahrer.name} mit ${kfz}`);
  if (v.gruende.length > 0) {
    teile.push(`weil er ${v.gruende.join(", ")}.`);
  }
  teile.push(`Geschätzte Anfahrt: ${v.etaMin} Min.`);
  void order;
  return teile.join(", ").replace(", weil", ", weil").replace(", Geschätzte", ". Geschätzte");
}

/**
 * Hauptfunktion: liefert die beste Fahrer-/Fahrzeug-Empfehlung plus
 * Alternativen für einen Auftrag. Reine Empfehlung – keine Auto-Zuweisung.
 *
 * @param order      Der (unzugewiesene) Auftrag
 * @param drivers    Verfügbare Fahrer
 * @param vehicles   Flotte (für Eignungsprüfung)
 * @param alleAuftraege Alle aktiven Aufträge (für Anschlussfahrt-Konflikte)
 */
export function empfehleFuerAuftrag(
  order: Auftrag,
  drivers: Fahrer[],
  vehicles: Fahrzeug[] = [],
  alleAuftraege: Auftrag[] = [],
): VorschlagErgebnis {
  // Belegte Fahrer rund um den Termin (±90 Min) erfassen
  const belegteFahrer = new Map<string, number>();
  const terminMs = new Date(order.termin).getTime();
  for (const a of alleAuftraege) {
    if (a.id === order.id || !a.fahrer) continue;
    if (a.status === "abgeschlossen" || a.status === "storniert") continue;
    const diff = Math.abs(new Date(a.termin).getTime() - terminMs);
    if (diff <= 90 * 60000) {
      belegteFahrer.set(a.fahrer, (belegteFahrer.get(a.fahrer) ?? 0) + 1);
    }
  }

  const bewertet = drivers
    .map((f) => bewerteFuerAuftrag(f, order, vehicles, belegteFahrer))
    .filter((v): v is FahrerVorschlag => v !== null)
    .sort((a, b) => b.score - a.score);

  if (bewertet.length === 0) {
    return { empfehlung: null, alternativen: [] };
  }

  bewertet.forEach((v) => {
    v.begruendung = baueBegruendung(v, order);
  });

  return {
    empfehlung: bewertet[0],
    alternativen: bewertet.slice(1, 3),
  };
}
