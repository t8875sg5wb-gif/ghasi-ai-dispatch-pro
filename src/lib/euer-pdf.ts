// PDF export for the Einnahmen-Überschuss-Rechnung (jsPDF, client-side).
import { jsPDF } from "jspdf";

import { EUR2 } from "@/lib/finance";
import type { CompanySettings } from "@/lib/company-settings.functions";
import type { EuerErgebnis } from "@/lib/euer";
import { STEUER_DISCLAIMER } from "@/lib/steuer";

export function generateEuerPdf(e: EuerErgebnis, company: CompanySettings): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginL = 20;
  const marginR = 190;
  let y = 22;

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(`Einnahmen-Überschuss-Rechnung ${e.jahr}`, marginL, y);
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
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, marginL + indent, y);
    doc.text(value, marginR, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 6;
  };

  y += 10;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Betriebseinnahmen", marginL, y);
  doc.setFont("helvetica", "normal");
  y += 7;
  doc.setFontSize(9.5);
  for (const z of e.einnahmen) row(z.label, EUR2(z.summe), false, 3);
  row("Summe Betriebseinnahmen", EUR2(e.einnahmenSumme), true);

  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Betriebsausgaben", marginL, y);
  doc.setFont("helvetica", "normal");
  y += 7;
  doc.setFontSize(9.5);
  for (const z of e.ausgaben) row(z.label, EUR2(z.summe), false, 3);
  row("Summe Betriebsausgaben", EUR2(e.ausgabenSumme), true);

  y += 6;
  doc.setDrawColor(180);
  doc.line(marginL, y, marginR, y);
  y += 8;
  doc.setFontSize(12);
  row(e.gewinn >= 0 ? "Gewinn" : "Verlust", EUR2(e.gewinn), true);

  y += 4;
  doc.setFontSize(8.5);
  doc.setTextColor(110);
  doc.text(
    `Im §4-Nr.17b-Modus nicht abziehbare Vorsteuer (informativ): ${EUR2(e.hinweisVorsteuer)}`,
    marginL,
    y,
  );
  y += 6;
  doc.text(
    doc.splitTextToSize(
      "Vorbereitung für Ihre Steuererklärung — Übertragung an das Finanzamt erfolgt über ELSTER (Anlage EÜR). " +
        STEUER_DISCLAIMER,
      marginR - marginL,
    ),
    marginL,
    y,
  );
  doc.setTextColor(0);

  return doc;
}

export function downloadEuerPdf(e: EuerErgebnis, company: CompanySettings) {
  generateEuerPdf(e, company).save(`EUER-${e.jahr}.pdf`);
}
