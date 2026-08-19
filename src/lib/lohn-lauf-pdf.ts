// PDF-Export für freigegebene Lohnläufe (jsPDF, clientseitig).
// Aufbau bewusst identisch zum Muster in `src/lib/euer-pdf.ts` – keine
// zweite PDF-Lösung. Reiner Lesevorgang, es werden keine Daten verändert.
import { jsPDF } from "jspdf";

import type { CompanySettings } from "@/lib/company-settings.functions";
import { EUR2 } from "@/lib/finance";
import { VERGUETUNGSART_LABEL } from "@/lib/employment-shared";
import { monatLabel, type Lohnlauf } from "@/lib/payroll-run-shared";
import { REGEL_KATEGORIE_LABEL } from "@/lib/payroll-shared";

/**
 * Pflicht-Hinweis für alle Lohn-Exporte (payroll-spezifisches Gegenstück zu
 * `STEUER_DISCLAIMER`). Muss im PDF gut sichtbar erscheinen.
 */
export const LOHN_DISCLAIMER =
  "Interner Entwurf — keine zertifizierte Lohnabrechnungssoftware, keine Übermittlung an Finanzamt " +
  "oder Sozialversicherungsträger. Ersetzt keine steuerliche/sozialversicherungsrechtliche Beratung.";

export function generateLohnlaufPdf(
  lauf: Lohnlauf,
  fahrerName: string,
  company: CompanySettings,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginL = 20;
  const marginR = 190;
  let y = 22;

  const seitenumbruch = (bedarf = 12) => {
    if (y + bedarf > 280) {
      doc.addPage();
      y = 22;
    }
  };

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(`Lohnlauf ${monatLabel(lauf.periodeMonat)}`, marginL, y);
  doc.setFont("helvetica", "normal");

  y += 7;
  doc.setFontSize(9);
  doc.setTextColor(110);
  const header = [company.firma, company.inhaber, company.adresse].filter(Boolean).join(" · ");
  doc.text(header, marginL, y);
  if (company.steuernummer) {
    y += 4.5;
    doc.text(`Steuernummer: ${company.steuernummer}`, marginL, y);
  }
  doc.setTextColor(0);

  const row = (label: string, value: string, bold = false, indent = 0) => {
    seitenumbruch();
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, marginL + indent, y);
    doc.text(value, marginR, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 6;
  };

  // Pflicht-Hinweis direkt oben, gut sichtbar.
  y += 8;
  doc.setFontSize(9);
  doc.setDrawColor(150);
  const hinweis = doc.splitTextToSize(LOHN_DISCLAIMER, marginR - marginL - 6);
  const boxH = hinweis.length * 4.6 + 6;
  doc.rect(marginL, y - 4, marginR - marginL, boxH);
  doc.setFont("helvetica", "bold");
  doc.text(hinweis, marginL + 3, y + 1);
  doc.setFont("helvetica", "normal");
  y += boxH + 6;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Stammangaben", marginL, y);
  doc.setFont("helvetica", "normal");
  y += 7;
  doc.setFontSize(9.5);
  row("Fahrer", fahrerName, false, 3);
  row("Abrechnungsmonat", monatLabel(lauf.periodeMonat), false, 3);
  row(
    "Vergütungsart",
    lauf.verguetungsart ? VERGUETUNGSART_LABEL[lauf.verguetungsart] : "—",
    false,
    3,
  );
  if (lauf.stunden !== null) row("Stunden", lauf.stunden.toFixed(2), false, 3);
  if (lauf.stundenlohn !== null) row("Stundenlohn", EUR2(lauf.stundenlohn), false, 3);
  row(
    "Freigegeben am",
    lauf.freigegebenAm ? new Date(lauf.freigegebenAm).toLocaleString("de-DE") : "—",
    false,
    3,
  );
  row("Stand (Version)", String(lauf.version), false, 3);

  y += 6;
  seitenumbruch(24);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Einzelposten", marginL, y);
  doc.setFont("helvetica", "normal");
  y += 7;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Kennung / Bezeichnung", marginL, y);
  doc.text("Kategorie", 105, y);
  doc.text("Betrag", marginR, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 2;
  doc.setDrawColor(200);
  doc.line(marginL, y, marginR, y);
  y += 5;

  if (lauf.posten.length === 0) {
    doc.text("Keine Einzelposten vorhanden.", marginL, y);
    y += 6;
  }
  for (const p of lauf.posten) {
    seitenumbruch(14);
    doc.setFontSize(8.5);
    doc.text(`${p.regelKennung} — ${p.regelBezeichnung}`, marginL, y);
    doc.text(REGEL_KATEGORIE_LABEL[p.kategorie], 105, y);
    doc.text(EUR2(p.betrag), marginR, y, { align: "right" });
    y += 4.2;
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    const details = [
      `Basis ${EUR2(p.basisbetrag)}`,
      p.prozentsatz !== null ? `${p.prozentsatz} %` : null,
      p.festbetrag !== null ? `Festbetrag ${EUR2(p.festbetrag)}` : null,
      `Quelle: ${p.quelle} (Version ${p.quelleVersion})`,
    ]
      .filter(Boolean)
      .join(" · ");
    doc.text(doc.splitTextToSize(details, marginR - marginL - 3), marginL + 3, y);
    doc.setTextColor(0);
    y += 6;
  }

  y += 2;
  seitenumbruch(34);
  doc.setDrawColor(180);
  doc.line(marginL, y, marginR, y);
  y += 8;
  doc.setFontSize(9.5);
  row("Bruttolohn", lauf.brutto !== null ? EUR2(lauf.brutto) : "—", true);
  row("Summe Abzüge", lauf.summeAbzuege !== null ? EUR2(lauf.summeAbzuege) : "—", true);
  row("Netto (Auszahlung an Fahrer)", lauf.netto !== null ? EUR2(lauf.netto) : "—", true);
  row(
    "Summe Arbeitgeberkosten",
    lauf.summeArbeitgeberkosten !== null ? EUR2(lauf.summeArbeitgeberkosten) : "—",
    true,
  );

  y += 6;
  seitenumbruch(20);
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text(
    doc.splitTextToSize(
      `${LOHN_DISCLAIMER} Kein DATEV-Austauschformat, keine Auszahlung oder Banküberweisung.`,
      marginR - marginL,
    ),
    marginL,
    y,
  );
  doc.setTextColor(0);

  return doc;
}

export function downloadLohnlaufPdf(
  lauf: Lohnlauf,
  fahrerName: string,
  company: CompanySettings,
) {
  generateLohnlaufPdf(lauf, fahrerName, company).save(
    `Lohnlauf-${lauf.periodeMonat.slice(0, 7)}-${fahrerName.replace(/[^\w-]+/g, "_")}.pdf`,
  );
}
