// ============================================================
// GHASI AI — Kassenvertrags-Preisermittlung (Schiene A)
// ------------------------------------------------------------
// Client- & server-sichere, reine Helfer, die für einen Transport den
// passenden genehmigten Kassenvertrag (insurer_contracts) finden und den
// erwarteten Preis liefern. Verfassung Art. 8: Es wird NIE ein Preis
// erfunden – existiert kein passender Vertrag, wird `null` zurückgegeben.
// ============================================================
import type { Kassenvertrag } from "@/lib/insurer-contracts-shared";
import type { Transportart } from "@/lib/auftraege";
import { zuzahlungKrankenfahrt } from "@/lib/gesetzeswerte";

/** Schlagworte je Transportart, um sie mit dem freien Vertragstext (leistung) zu matchen. */
const TRANSPORTART_KEYWORDS: Record<Transportart, string[]> = {
  Liegendtransport: ["liege", "liegend", "trage", "lmw"],
  Sitzendtransport: ["sitz", "sitzend", "gehf", "btw", "taxi", "mietwagen"],
  Rollstuhl: ["rollstuhl", "rolli", "btw"],
  Dialysefahrt: ["dialyse", "dialysefahrt", "serien", "dauer"],
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Gilt der Vertrag zum Stichtag (ISO-Datum, Standard heute)? */
function istGueltig(v: Kassenvertrag, stichtag: string): boolean {
  if (v.gueltigAb && v.gueltigAb > stichtag) return false;
  if (v.gueltigBis && v.gueltigBis < stichtag) return false;
  return true;
}

/**
 * Findet den am besten passenden, genehmigten und gültigen Kassenvertrag für
 * einen Kostenträger (insurerId) und eine Transportart. Gibt `null` zurück,
 * wenn kein passender Vertrag hinterlegt ist.
 */
export function findeKassenvertrag(
  contracts: Kassenvertrag[],
  insurerId: string | null | undefined,
  transportart: Transportart,
  stichtag: string = new Date().toISOString().slice(0, 10),
): Kassenvertrag | null {
  if (!insurerId) return null;
  const keywords = TRANSPORTART_KEYWORDS[transportart] ?? [];

  const kandidaten = contracts.filter(
    (v) => v.insurerId === insurerId && v.genehmigt && istGueltig(v, stichtag),
  );
  if (kandidaten.length === 0) return null;

  // Bevorzuge Verträge, deren Leistungstext ein Transportart-Schlagwort enthält.
  const passend = kandidaten.filter((v) => {
    const l = normalize(v.leistung);
    return keywords.some((kw) => l.includes(kw));
  });

  const pool = passend.length > 0 ? passend : [];
  if (pool.length === 0) return null;

  // Neuester gültiger Vertrag zuerst (nach gueltigAb, sonst stabil).
  return [...pool].sort((a, b) => (b.gueltigAb ?? "").localeCompare(a.gueltigAb ?? ""))[0];
}

export interface VertragspreisInfo {
  /** Der gefundene Vertrag. */
  vertrag: Kassenvertrag;
  /** Erwarteter Gesamtpreis der Fahrt laut Vertrag. */
  preis: number;
  /** Einheit (z. B. "pro Fahrt"). */
  einheit: string;
  /** Patienten-Zuzahlung nach § 61 SGB V (0 € bei Befreiung). */
  patientenanteil: number;
  /** Anteil des Kostenträgers (Preis − Patientenanteil). */
  kassenanteil: number;
  /** Anzeige-Label für die Herkunft. */
  quelleLabel: string;
}

/**
 * Ermittelt den erwarteten Preis inkl. Patienten-/Kassenanteil aus dem
 * passenden Kassenvertrag. Gibt `null` zurück, wenn kein Vertrag existiert.
 */
export function ermittleVertragspreis(
  contracts: Kassenvertrag[],
  insurerId: string | null | undefined,
  transportart: Transportart,
  zuzahlungsbefreit: boolean = false,
  stichtag?: string,
): VertragspreisInfo | null {
  const vertrag = findeKassenvertrag(contracts, insurerId, transportart, stichtag);
  if (!vertrag) return null;
  const preis = Number(vertrag.preis) || 0;
  const patientenanteil = zuzahlungKrankenfahrt(preis, zuzahlungsbefreit);
  return {
    vertrag,
    preis,
    einheit: vertrag.einheit,
    patientenanteil,
    kassenanteil: Math.round((preis - patientenanteil) * 100) / 100,
    quelleLabel: `Preis aus Kassenvertrag${vertrag.aktenzeichen ? ` ${vertrag.aktenzeichen}` : ""}`,
  };
}

/** Neutraler Hinweis, wenn kein Vertrag gefunden wurde. */
export const KEIN_VERTRAG_HINWEIS = "Kein Kassenvertrag für diese Transportart hinterlegt";

/** Minimaler Kassen-Datensatz zum Namens-Matching. */
export interface InsurerLike {
  id: string;
  name: string;
  kuerzel?: string;
}

/**
 * Findet die insurerId zu einem freien Kostenträger-Namen (z. B. aus dem Auftrag).
 * Vergleicht normalisiert gegen Name und Kürzel. Gibt `null` zurück, wenn keine
 * eindeutige Übereinstimmung existiert.
 */
export function findeInsurerId(
  insurers: InsurerLike[],
  kostentraeger: string | null | undefined,
): string | null {
  if (!kostentraeger?.trim()) return null;
  const k = normalize(kostentraeger.trim());
  // 1) exakter Treffer auf Name/Kürzel
  const exakt = insurers.find(
    (i) => normalize(i.name) === k || (i.kuerzel && normalize(i.kuerzel) === k),
  );
  if (exakt) return exakt.id;
  // 2) Teilstring-Treffer (z. B. "AOK Nordost Sammelrechnung" → "AOK Nordost")
  const teil = insurers.find(
    (i) => normalize(i.name) && (k.includes(normalize(i.name)) || normalize(i.name).includes(k)),
  );
  return teil?.id ?? null;
}

