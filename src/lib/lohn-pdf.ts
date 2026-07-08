// PDF export for the monthly Lohn-Vorbereitung (jsPDF, client-side).
import { jsPDF } from "jspdf";

import { EUR2 } from "@/lib/finance";
import type { CompanySettings } from "@/lib/company-settings.functions";
import type { LohnErgebnis } from "@/lib/lohn";
import { BESCHAEFTIGUNGSART_LABEL } from "@/lib/fahrer";
import { STEUER_DISCLAIMER } from "@/lib/steuer";

export interface LohnZeile {
  name: string;
  ergebnis: LohnErgebnis;
}

export function generateLohnPdf(
  monat: string,
  zeilen: LohnZeile[],
  company: CompanySettings,
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginL = 20;
  const marginR = 190;
  let y = 22;

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(`Lohn-Vorbereitung ${monat}`, marginL, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text([company.firma, company.inhaber].filter(Boolean).join(" · "), marginL, y);
  doc.setTextColor(0);

  y += 10;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  const cols = { name: marginL, art: 62, brutto: 110, netto: 140, agGesamt: marginR };
  doc.text("Fahrer", cols.name, y);
  doc.text("Art", cols.art, y);
  doc.text("Brutto", cols.brutto, y, { align: "right" });
  doc.text("Netto", cols.netto, y, { align: "right" });
  doc.text("AG-Kosten", cols.agGesamt, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 2;
  doc.setDrawColor(200);
  doc.line(marginL, y, marginR, y);
  y += 5;

  let sumNetto = 0;
  let sumSv = 0;
  let sumSteuer = 0;
  let sumAg = 0;
  for (const z of zeilen) {
    const e = z.ergebnis;
    doc.text(doc.splitTextToSize(z.name, 40), cols.name, y);
    doc.text(BESCHAEFTIGUNGSART_LABEL[e.beschaeftigungsart].split(" ")[0], cols.art, y);
    doc.text(EUR2(e.brutto), cols.brutto, y, { align: "right" });
    doc.text(EUR2(e.netto), cols.netto, y, { align: "right" });
    doc.text(EUR2(e.agGesamt), cols.agGesamt, y, { align: "right" });
    y += 6;
    sumNetto += e.netto;
    sumSv += e.anSozialversicherung;
    sumSteuer += e.anFinanzamt;
    sumAg += e.agGesamt;
  }

  y += 2;
  doc.line(marginL, y, marginR, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  const summ = (label: string, value: number) => {
    doc.text(label, marginL, y);
    doc.text(EUR2(value), marginR, y, { align: "right" });
    y += 6;
  };
  summ("Auszahlung an Fahrer (Netto gesamt)", sumNetto);
  summ("An Krankenkasse/Minijob-Zentrale", sumSv);
  summ("An Finanzamt (Lohnsteuer)", sumSteuer);
  summ("Arbeitgeber-Gesamtkosten", sumAg);
  doc.setFont("helvetica", "normal");

  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    doc.splitTextToSize(
      "Alle Werte sind Näherungen (Stand 2026). Die offizielle Lohnabrechnung erfordert zertifizierte Software oder einen Lohnservice. " +
        STEUER_DISCLAIMER,
      marginR - marginL,
    ),
    marginL,
    y,
  );
  doc.setTextColor(0);

  return doc;
}

export function downloadLohnPdf(monat: string, zeilen: LohnZeile[], company: CompanySettings) {
  generateLohnPdf(monat, zeilen, company).save(`Lohn-${monat}.pdf`);
}
