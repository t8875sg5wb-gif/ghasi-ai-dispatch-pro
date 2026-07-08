// ============================================================
// GHASI AI — Compliance-Cockpit (Schiene A) Logik
// ------------------------------------------------------------
// Reine Funktionen: berechnen Pflichten, Fristen und Vollständigkeit
// aus echten Betriebsdaten. Nur Schiene-A-relevant (Krankenfahrten
// ohne medizinische Betreuung – keine KTW-/Rettungssanitäter-Themen).
// ============================================================
import { fristStatus, type FristInfo } from "@/lib/compliance-dates";
import type { Fahrer } from "@/lib/fahrer";
import type { Fahrzeug } from "@/lib/fahrzeuge";
import type { Versicherung } from "@/lib/versicherungen";
import type { Leasingvertrag } from "@/lib/leasing";
import type { Patient } from "@/lib/stammdaten";
import type { Auftrag } from "@/lib/auftraege";
import type { Rechnung } from "@/lib/finance";
import type { Kassenvertrag } from "@/lib/insurer-contracts-shared";
import type { Krankenkasse } from "@/lib/insurers-shared";
import type { CompanySettings } from "@/lib/company-settings.functions";
import { brutto, summeZahlungen, tageUeberfaellig } from "@/lib/finance";

/** Kfz-Haftpflicht-Mindestdeckung (Referenz). */
export const HAFTPFLICHT_MINDESTDECKUNG = {
  personen: "7,5 Mio € (Personenschäden)",
  sach: "1,22 Mio € (Sachschäden)",
};

export type PflichtStatus = "ok" | "warnung" | "kritisch" | "offen" | "info";

export interface CompliancePflicht {
  id: string;
  kategorie: string;
  titel: string;
  status: PflichtStatus;
  detail: string;
  /** Handlungsanleitung */
  schritte?: string;
}

const statusVonFrist = (f: FristInfo): PflichtStatus => {
  if (f.status === "abgelaufen") return "kritisch";
  if (f.status === "bald") return "warnung";
  if (f.status === "fehlt") return "offen";
  return "ok";
};

export interface ComplianceInput {
  fahrzeuge: Fahrzeug[];
  fahrer: Fahrer[];
  versicherungen: Versicherung[];
  leasing: Leasingvertrag[];
  patienten: Patient[];
  auftraege: Auftrag[];
  rechnungen: Rechnung[];
  vertraege: Kassenvertrag[];
  kassen: Krankenkasse[];
  company: CompanySettings;
}

/** Wiederkehrende Pflichten mit Fristen & Status. */
export function computePflichten(input: ComplianceInput): CompliancePflicht[] {
  const out: CompliancePflicht[] = [];

  // TÜV je Fahrzeug
  for (const v of input.fahrzeuge) {
    const f = fristStatus(v.tuevBis, 45);
    out.push({
      id: `tuev-${v.id}`,
      kategorie: "Fahrzeuge",
      titel: `TÜV/HU – ${v.kennzeichen}`,
      status: statusVonFrist(f),
      detail: f.label,
      schritte: "Hauptuntersuchung (§29 StVZO) rechtzeitig bei TÜV/DEKRA terminieren.",
    });
  }

  // Versicherungen (Ablauf/Erneuerung)
  for (const p of input.versicherungen) {
    if (p.status === "gekuendigt") continue;
    const f = fristStatus(p.ablauf, 45);
    out.push({
      id: `vers-${p.id}`,
      kategorie: "Versicherungen",
      titel: `${p.art} – ${p.fahrzeug || p.versicherer}`,
      status: statusVonFrist(f),
      detail: f.label,
      schritte: `Police ${p.policennummer} prüfen. Kfz-Haftpflicht-Mindestdeckung: ${HAFTPFLICHT_MINDESTDECKUNG.personen}, ${HAFTPFLICHT_MINDESTDECKUNG.sach}.`,
    });
  }

  // P-Schein je Fahrer
  for (const d of input.fahrer) {
    const f = fristStatus(d.pScheinGueltigBis, 45);
    out.push({
      id: `pschein-${d.id}`,
      kategorie: "Fahrer",
      titel: `Personenbeförderungsschein – ${d.name}`,
      status: statusVonFrist(f),
      detail: f.label,
      schritte: "P-Schein (§48 FeV) vor Ablauf verlängern (ärztliche Untersuchung erforderlich).",
    });
  }

  // Statische wiederkehrende Pflichten
  out.push({
    id: "bg-verkehr",
    kategorie: "Behörden",
    titel: "BG Verkehr – Mitgliedschaft & Lohnnachweis",
    status: "info",
    detail: "Jährlicher digitaler Lohnnachweis bis 16.02. des Folgejahres.",
    schritte: "Mitgliedschaft bei der BG Verkehr führen und Lohnnachweis fristgerecht übermitteln.",
  });
  out.push({
    id: "gesundheitsamt",
    kategorie: "Behörden",
    titel: "Gesundheitsamt – Desinfektions-/Hygieneplan",
    status: "info",
    detail: "Desinfektionsplan aktuell halten, Fahrzeuge regelmäßig desinfizieren.",
    schritte: "Hygieneplan dokumentieren; bei sitzenden Krankenfahrten keine KTW-Anforderungen.",
  });
  out.push({
    id: "dsgvo",
    kategorie: "Datenschutz",
    titel: "DSGVO-Basics",
    status: "info",
    detail: "Verzeichnis von Verarbeitungstätigkeiten, AV-Verträge, TOMs.",
    schritte: "Patientendaten nur zweckgebunden speichern; Löschfristen beachten.",
  });

  // §133 SGB V Voraussetzungen
  const ikOk = !!input.company.ikNummer?.trim();
  out.push({
    id: "ik-nummer",
    kategorie: "§133 SGB V",
    titel: "IK-Nummer (Institutionskennzeichen)",
    status: ikOk ? "ok" : "offen",
    detail: ikOk ? `Gepflegt: ${input.company.ikNummer}` : "IK-Nummer fehlt in den Firmendaten.",
    schritte: "IK-Nummer bei der ARGE·IK beantragen und in den Einstellungen hinterlegen.",
  });
  out.push({
    id: "genehmigung",
    kategorie: "§133 SGB V",
    titel: "Genehmigung / Gewerbeanmeldung",
    status: "info",
    detail: "Gewerbeanmeldung und Genehmigung für Krankenfahrten vorhalten.",
    schritte: "Betriebsleiter erst ab 11+ Fahrzeugen erforderlich.",
  });

  // Rahmenverträge je Kasse
  const kassenMitVertrag = new Set(
    input.vertraege.filter((c) => c.genehmigt).map((c) => c.insurerId),
  );
  for (const k of input.kassen) {
    const hat = kassenMitVertrag.has(k.id);
    out.push({
      id: `rahmenvertrag-${k.id}`,
      kategorie: "§133 SGB V",
      titel: `Rahmenvertrag – ${k.name}`,
      status: hat ? "ok" : "offen",
      detail: hat ? "Genehmigte Preisvereinbarung vorhanden." : "Kein genehmigter Vertrag hinterlegt.",
      schritte: hat ? undefined : "Preisvereinbarung nach §133 SGB V mit der Kasse abschließen.",
    });
  }

  return out;
}

export interface VollstaendigkeitsLuecke {
  bereich: string;
  eintrag: string;
  fehlend: string[];
}

/** „Was fehlt noch?" – prüft echte Daten auf fehlende Pflichtangaben. */
export function computeVollstaendigkeit(input: ComplianceInput): VollstaendigkeitsLuecke[] {
  const out: VollstaendigkeitsLuecke[] = [];

  for (const d of input.fahrer) {
    const fehlend: string[] = [];
    if (!d.pScheinGueltigBis) fehlend.push("P-Schein-Datum");
    if (!d.fuehrungszeugnisDatum) fehlend.push("Führungszeugnis");
    if (!d.svAusweisVorhanden) fehlend.push("SV-Ausweis");
    if (!d.steuerId) fehlend.push("Steuer-ID");
    if (fehlend.length > 0) out.push({ bereich: "Fahrer", eintrag: d.name, fehlend });
  }

  // Patienten mit Aufträgen
  const patientenMitAuftrag = new Set(
    input.auftraege.map((a) => a.patient).filter(Boolean),
  );
  for (const p of input.patienten) {
    if (!patientenMitAuftrag.has(p.name)) continue;
    const fehlend: string[] = [];
    if (!p.versichertennummer) fehlend.push("Versichertennummer");
    if (!p.verordnungVorhanden) fehlend.push("Verordnung");
    if (!p.kostentraeger?.trim()) fehlend.push("Kostenträger");
    if (fehlend.length > 0) out.push({ bereich: "Patienten", eintrag: p.name, fehlend });
  }

  // Firma
  const firmaFehlt: string[] = [];
  if (!input.company.ikNummer?.trim()) firmaFehlt.push("IK-Nummer");
  if (!input.company.steuernummer?.trim()) firmaFehlt.push("Steuernummer");
  if (firmaFehlt.length > 0)
    out.push({ bereich: "Firma", eintrag: input.company.firma, fehlend: firmaFehlt });

  return out;
}

export interface ZahlungsPosten {
  titel: string;
  betrag: number;
}

export interface ZahlungsUebersicht {
  ausgehend: ZahlungsPosten[];
  eingehend: ZahlungsPosten[];
  ausgehendSumme: number;
  eingehendSumme: number;
}

/** Zahlungsübersicht: anstehende Ausgaben & offene Forderungen. */
export function computeZahlungsUebersicht(
  input: ComplianceInput,
  loehneMonat: number,
): ZahlungsUebersicht {
  const versSumme = input.versicherungen
    .filter((p) => p.status !== "gekuendigt")
    .reduce((s, p) => s + p.beitragMonat, 0);
  const leasingSumme = input.leasing
    .filter((l) => l.status === "aktiv")
    .reduce((s, l) => s + l.rateMonat, 0);

  const ausgehend: ZahlungsPosten[] = [
    { titel: "Löhne (Vorbereitung, monatlich)", betrag: loehneMonat },
    { titel: "Versicherungsbeiträge (monatlich)", betrag: versSumme },
    { titel: "Leasingraten (monatlich)", betrag: leasingSumme },
  ];

  const offene = input.rechnungen.filter(
    (r) => r.typ === "rechnung" && !["bezahlt", "storniert", "entwurf"].includes(r.status),
  );
  const offenSumme = offene.reduce((s, r) => s + (brutto(r) - summeZahlungen(r)), 0);
  const ueberfaellig = offene.filter((r) => tageUeberfaellig(r) > 0);
  const ueberfaelligSumme = ueberfaellig.reduce(
    (s, r) => s + (brutto(r) - summeZahlungen(r)),
    0,
  );

  const eingehend: ZahlungsPosten[] = [
    { titel: `Offene Forderungen (${offene.length})`, betrag: offenSumme },
    { titel: `davon überfällig (${ueberfaellig.length})`, betrag: ueberfaelligSumme },
  ];

  return {
    ausgehend,
    eingehend,
    ausgehendSumme: ausgehend.reduce((s, p) => s + p.betrag, 0),
    eingehendSumme: offenSumme,
  };
}
