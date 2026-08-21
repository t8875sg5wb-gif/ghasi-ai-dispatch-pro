// ============================================================
// GHASI AI — XRechnung-Exportentwurf (EN 16931 / UBL-Syntax)
// ------------------------------------------------------------
// PFLICHT-HINWEIS (identisch im UI vor dem Download sichtbar):
// Dieser Export ist NICHT gegen den offiziellen XRechnung-Validator
// (KoSIT) geprüft. Vor jeglicher echten Nutzung — insbesondere Versand
// an Behörden oder Kostenträger — muss die Datei mit dem offiziellen
// Validator geprüft werden.
//
// Reine, seiteneffektfreie Funktion (testbar, keine DB-Zugriffe, kein
// Versand). Es findet KEINE Übermittlung an Portale (PEPPOL, ZRE) statt —
// nur ein lokaler Datei-Download.
//
// Es werden ausschließlich vorhandene, strukturierte Daten verwendet.
// Fehlt eine Pflichtangabe (Firmenadresse/IBAN unbestätigt, Kundenadresse
// unvollständig), wird KEINE Adresse geraten, sondern der Export verweigert.
// ============================================================
import type { Rechnung } from "@/lib/finance";
import { STEUER_HINWEIS, type SteuerModus } from "@/lib/steuer";

export const XRECHNUNG_WARNUNG =
  "Dieser Export ist NICHT gegen den offiziellen XRechnung-Validator (KoSIT) geprüft. " +
  "Vor jeglicher echten Nutzung — insbesondere Versand an Behörden oder Kostenträger — " +
  "muss die Datei mit dem offiziellen Validator geprüft werden.";

export const XRECHNUNG_LEITWEG_FEHLT_HINWEIS =
  "Für diesen Kunden ist keine Leitweg-ID hinterlegt. Öffentlich-rechtliche Empfänger " +
  "(z. B. Krankenkassen, Behörden) weisen Rechnungen ohne Leitweg-ID in der Regel zurück.";

export const XRECHNUNG_FIRMA_UNBESTAETIGT =
  "XRechnung-Export gesperrt: Bitte zuerst die strukturierte Firmenadresse und die IBAN " +
  "in den Einstellungen eintragen und speichern (Bestätigung durch einen Administrator).";

export const XRECHNUNG_KUNDENADRESSE_FEHLT = "Kundenadresse unvollständig";

/** Strukturierte Adresse in der von XRechnung geforderten Feldtrennung. */
export interface XrAdresse {
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  /** ISO-3166-1-Alpha-2, z. B. "DE". */
  land: string;
}

export interface XrVerkaeufer {
  name: string;
  adresse: XrAdresse;
  email: string;
  telefon: string;
  steuernummer: string;
  ustId: string;
  iban: string;
}

export interface XrKaeufer {
  name: string;
  adresse: XrAdresse;
  email?: string;
  /** Leitweg-ID (BT-10 BuyerReference); optional, aber für Behörden Pflicht. */
  leitwegId?: string;
}

export function adresseVollstaendig(a: XrAdresse | null | undefined): boolean {
  if (!a) return false;
  return Boolean(a.strasse.trim() && a.plz.trim() && a.ort.trim() && a.land.trim());
}

/** Nur echte, ausgestellte Rechnungen dürfen exportiert werden. */
export function istExportierbar(status: Rechnung["status"]): boolean {
  return status !== "entwurf" && status !== "storniert";
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** UBL erwartet Punkt als Dezimaltrenner mit zwei Nachkommastellen. */
function num(n: number): string {
  return round2(n).toFixed(2);
}

export function escapeXml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function el(tag: string, value: string | number, attrs = ""): string {
  return `<${tag}${attrs ? ` ${attrs}` : ""}>${escapeXml(String(value))}</${tag}>`;
}

function adresseXml(a: XrAdresse, indent: string): string {
  const strasse = [a.strasse, a.hausnummer].filter((s) => s.trim()).join(" ");
  return [
    `${indent}<cac:PostalAddress>`,
    `${indent}  ${el("cbc:StreetName", strasse)}`,
    `${indent}  ${el("cbc:CityName", a.ort)}`,
    `${indent}  ${el("cbc:PostalZone", a.plz)}`,
    `${indent}  <cac:Country>${el("cbc:IdentificationCode", a.land.toUpperCase())}</cac:Country>`,
    `${indent}</cac:PostalAddress>`,
  ].join("\n");
}

export interface XrechnungEingabe {
  rechnung: Rechnung;
  verkaeufer: XrVerkaeufer;
  kaeufer: XrKaeufer;
  /** Steuermodus des Unternehmens (für die §-4-Nr.-17b-Begründung). */
  steuerModus: SteuerModus;
}

export interface XrechnungErgebnis {
  xml: string;
  dateiname: string;
  /** Fehlt die Leitweg-ID? (UI warnt, blockiert aber nicht.) */
  leitwegFehlt: boolean;
}

/**
 * Erzeugt die XRechnung (UBL-Invoice) für EINE bereits gestellte Rechnung.
 * Wirft bei fehlenden Pflichtdaten — es wird nichts geschätzt oder ergänzt.
 */
export function generateXRechnung(input: XrechnungEingabe): XrechnungErgebnis {
  const { rechnung: r, verkaeufer, kaeufer, steuerModus } = input;

  if (!istExportierbar(r.status)) {
    throw new Error(
      "Nur ausgestellte Rechnungen können exportiert werden (nicht Entwurf, nicht storniert).",
    );
  }
  if (!adresseVollstaendig(verkaeufer.adresse) || !verkaeufer.iban.trim()) {
    throw new Error(XRECHNUNG_FIRMA_UNBESTAETIGT);
  }
  if (!adresseVollstaendig(kaeufer.adresse)) {
    throw new Error(
      `${XRECHNUNG_KUNDENADRESSE_FEHLT}: Für „${kaeufer.name}“ fehlen strukturierte Adressfelder ` +
        "(Straße, PLZ, Ort, Land). Bitte im Kundenstamm ergänzen — es wird keine Adresse geraten.",
    );
  }

  const positionen = r.positionen ?? [];
  const zeilen = positionen.map((p, i) => ({
    nr: i + 1,
    beschreibung: p.beschreibung,
    menge: p.menge,
    einzelpreis: p.einzelpreis,
    netto: round2(p.menge * p.einzelpreis),
  }));

  const satz = r.mwstSatz ?? 0;
  // Positionssummen sind die verlässliche Netto-Grundlage; ohne Positionen
  // (Altbestand) wird der Rechnungsbetrag als Netto/Brutto-Basis verwendet.
  const nettoSumme = zeilen.length
    ? round2(zeilen.reduce((s, z) => s + z.netto, 0))
    : round2(satz > 0 ? r.betrag / (1 + satz / 100) : r.betrag);
  const ust = round2(nettoSumme * (satz / 100));
  const brutto = round2(nettoSumme + ust);

  // USt-Behandlung: bei 0 % ist eine Befreiungsbegründung Pflicht (BT-120/BT-121).
  const steuerKategorie = satz > 0 ? "S" : "E";
  const befreiungsgrund = STEUER_HINWEIS[steuerModus];

  const leitwegFehlt = !(kaeufer.leitwegId ?? "").trim();
  // BT-10 ist Pflichtfeld in XRechnung; ohne Leitweg-ID wird bewusst KEIN
  // Platzhalter erfunden, sondern das Feld leer geliefert und im UI gewarnt.
  const buyerReference = (kaeufer.leitwegId ?? "").trim();

  const lines = zeilen
    .map((z) =>
      [
        `  <cac:InvoiceLine>`,
        `    ${el("cbc:ID", z.nr)}`,
        `    ${el("cbc:InvoicedQuantity", num(z.menge), 'unitCode="C62"')}`,
        `    ${el("cbc:LineExtensionAmount", num(z.netto), 'currencyID="EUR"')}`,
        `    <cac:Item>`,
        `      ${el("cbc:Name", z.beschreibung || "Krankentransport")}`,
        `      <cac:ClassifiedTaxCategory>`,
        `        ${el("cbc:ID", steuerKategorie)}`,
        `        ${el("cbc:Percent", num(satz))}`,
        `        <cac:TaxScheme>${el("cbc:ID", "VAT")}</cac:TaxScheme>`,
        `      </cac:ClassifiedTaxCategory>`,
        `    </cac:Item>`,
        `    <cac:Price>${el("cbc:PriceAmount", num(z.einzelpreis), 'currencyID="EUR"')}</cac:Price>`,
        `  </cac:InvoiceLine>`,
      ].join("\n"),
    )
    .join("\n");

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- ENTWURF: NICHT gegen den offiziellen XRechnung-Validator (KoSIT) geprüft.`,
    `     Vor jeglicher echten Nutzung (Versand an Behörden/Kostenträger) muss die`,
    `     Datei mit dem offiziellen Validator geprüft werden. -->`,
    `<ubl:Invoice xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"`,
    `             xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"`,
    `             xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">`,
    `  ${el("cbc:CustomizationID", "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0")}`,
    `  ${el("cbc:ProfileID", "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0")}`,
    `  ${el("cbc:ID", r.nummer)}`,
    `  ${el("cbc:IssueDate", r.datum)}`,
    `  ${el("cbc:DueDate", r.faelligkeit)}`,
    `  ${el("cbc:InvoiceTypeCode", r.typ === "gutschrift" ? 381 : 380)}`,
    r.notiz ? `  ${el("cbc:Note", r.notiz)}` : "",
    `  ${el("cbc:DocumentCurrencyCode", "EUR")}`,
    `  ${el("cbc:BuyerReference", buyerReference)}`,
    r.leistungsdatum
      ? [
          `  <cac:InvoicePeriod>`,
          `    ${el("cbc:StartDate", r.leistungsdatum)}`,
          `    ${el("cbc:EndDate", r.leistungsdatum)}`,
          `  </cac:InvoicePeriod>`,
        ].join("\n")
      : "",
    `  <cac:AccountingSupplierParty>`,
    `    <cac:Party>`,
    `      ${el("cbc:EndpointID", verkaeufer.email, 'schemeID="EM"')}`,
    adresseXml(verkaeufer.adresse, "      "),
    verkaeufer.ustId.trim()
      ? [
          `      <cac:PartyTaxScheme>`,
          `        ${el("cbc:CompanyID", verkaeufer.ustId)}`,
          `        <cac:TaxScheme>${el("cbc:ID", "VAT")}</cac:TaxScheme>`,
          `      </cac:PartyTaxScheme>`,
        ].join("\n")
      : [
          `      <cac:PartyTaxScheme>`,
          `        ${el("cbc:CompanyID", verkaeufer.steuernummer)}`,
          `        <cac:TaxScheme>${el("cbc:ID", "FC")}</cac:TaxScheme>`,
          `      </cac:PartyTaxScheme>`,
        ].join("\n"),
    `      <cac:PartyLegalEntity>${el("cbc:RegistrationName", verkaeufer.name)}</cac:PartyLegalEntity>`,
    `      <cac:Contact>`,
    `        ${el("cbc:Name", verkaeufer.name)}`,
    `        ${el("cbc:Telephone", verkaeufer.telefon)}`,
    `        ${el("cbc:ElectronicMail", verkaeufer.email)}`,
    `      </cac:Contact>`,
    `    </cac:Party>`,
    `  </cac:AccountingSupplierParty>`,
    `  <cac:AccountingCustomerParty>`,
    `    <cac:Party>`,
    kaeufer.email ? `      ${el("cbc:EndpointID", kaeufer.email, 'schemeID="EM"')}` : "",
    adresseXml(kaeufer.adresse, "      "),
    `      <cac:PartyLegalEntity>${el("cbc:RegistrationName", kaeufer.name)}</cac:PartyLegalEntity>`,
    `    </cac:Party>`,
    `  </cac:AccountingCustomerParty>`,
    `  <cac:PaymentMeans>`,
    `    ${el("cbc:PaymentMeansCode", 58)}`,
    `    ${el("cbc:PaymentID", r.nummer)}`,
    `    <cac:PayeeFinancialAccount>${el("cbc:ID", verkaeufer.iban.replace(/\s+/g, ""))}</cac:PayeeFinancialAccount>`,
    `  </cac:PaymentMeans>`,
    `  <cac:TaxTotal>`,
    `    ${el("cbc:TaxAmount", num(ust), 'currencyID="EUR"')}`,
    `    <cac:TaxSubtotal>`,
    `      ${el("cbc:TaxableAmount", num(nettoSumme), 'currencyID="EUR"')}`,
    `      ${el("cbc:TaxAmount", num(ust), 'currencyID="EUR"')}`,
    `      <cac:TaxCategory>`,
    `        ${el("cbc:ID", steuerKategorie)}`,
    `        ${el("cbc:Percent", num(satz))}`,
    satz === 0 ? `        ${el("cbc:TaxExemptionReason", befreiungsgrund)}` : "",
    `        <cac:TaxScheme>${el("cbc:ID", "VAT")}</cac:TaxScheme>`,
    `      </cac:TaxCategory>`,
    `    </cac:TaxSubtotal>`,
    `  </cac:TaxTotal>`,
    `  <cac:LegalMonetaryTotal>`,
    `    ${el("cbc:LineExtensionAmount", num(nettoSumme), 'currencyID="EUR"')}`,
    `    ${el("cbc:TaxExclusiveAmount", num(nettoSumme), 'currencyID="EUR"')}`,
    `    ${el("cbc:TaxInclusiveAmount", num(brutto), 'currencyID="EUR"')}`,
    `    ${el("cbc:PayableAmount", num(brutto), 'currencyID="EUR"')}`,
    `  </cac:LegalMonetaryTotal>`,
    lines,
    `</ubl:Invoice>`,
  ]
    .filter((z) => z !== "")
    .join("\n");

  const safeNummer = r.nummer.replace(/[^\w.-]+/g, "_");
  return { xml, dateiname: `xrechnung-${safeNummer}.xml`, leitwegFehlt };
}
