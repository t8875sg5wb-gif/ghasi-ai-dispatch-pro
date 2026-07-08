// §14-UStG-compliant invoice PDF generation (client-side, jsPDF).
// Clean, professional German layout with full sender/recipient blocks,
// itemised positions, Netto/USt/Brutto and the legal exemption notice.
import { jsPDF } from "jspdf";

import type { Rechnung } from "@/lib/finance";
import { EUR, formatDatum, netto, mwstBetrag, brutto } from "@/lib/finance";
import type { CompanySettings } from "@/lib/company-settings.functions";
import { STEUER_HINWEIS, STEUER_DISCLAIMER, type SteuerModus } from "@/lib/steuer";

function steuerModusFuer(r: Rechnung, company: CompanySettings): SteuerModus {
  // If the invoice carries VAT, it is regular taxation; otherwise use the
  // company's configured mode (exempt / small business).
  if (r.mwstSatz > 0) return "regulaer_19";
  return company.steuerModus;
}

export function generateInvoicePdf(r: Rechnung, company: CompanySettings): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const marginL = 20;
  const marginR = 190;
  let y = 22;

  // --- Sender line (small, above recipient) ---
  doc.setFontSize(8);
  doc.setTextColor(120);
  const senderLine = [company.firma, company.adresse].filter(Boolean).join(" · ");
  doc.text(senderLine, marginL, y);
  doc.setTextColor(0);

  // --- Recipient block ---
  y += 10;
  doc.setFontSize(11);
  doc.text(r.kunde || "—", marginL, y);

  // --- Sender detail block (right) ---
  let ry = 22;
  doc.setFontSize(9);
  const senderDetail: string[] = [
    company.firma,
    company.inhaber ? `Inhaber: ${company.inhaber}` : "",
    ...(company.adresse ? company.adresse.split(",").map((s) => s.trim()) : []),
    company.telefon ? `Tel.: ${company.telefon}` : "",
    company.email || "",
    company.steuernummer ? `Steuernr.: ${company.steuernummer}` : "",
    company.ustId ? `USt-IdNr.: ${company.ustId}` : "",
    company.ikNummer ? `IK-Nr.: ${company.ikNummer}` : "",
  ].filter(Boolean);
  senderDetail.forEach((line) => {
    doc.text(line, marginR, ry, { align: "right" });
    ry += 4.5;
  });

  // --- Title & meta ---
  y = Math.max(y, ry) + 12;
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(r.typ === "gutschrift" ? "Gutschrift" : "Rechnung", marginL, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  y += 8;
  const meta: [string, string][] = [
    ["Rechnungsnummer", r.nummer],
    ["Rechnungsdatum", formatDatum(r.datum)],
    ["Leistungsdatum", r.leistungsdatum ? formatDatum(r.leistungsdatum) : formatDatum(r.datum)],
    ["Fällig bis", formatDatum(r.faelligkeit)],
  ];
  meta.forEach(([k, v]) => {
    doc.setTextColor(120);
    doc.text(`${k}:`, marginL, y);
    doc.setTextColor(0);
    doc.text(v, marginL + 40, y);
    y += 5;
  });

  // --- Positions table ---
  y += 6;
  const cols = { pos: marginL, besch: marginL + 10, menge: 120, einzel: 145, gesamt: marginR };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Pos.", cols.pos, y);
  doc.text("Beschreibung", cols.besch, y);
  doc.text("Menge", cols.menge, y, { align: "right" });
  doc.text("Einzel", cols.einzel, y, { align: "right" });
  doc.text("Gesamt", cols.gesamt, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 2;
  doc.setDrawColor(200);
  doc.line(marginL, y, marginR, y);
  y += 5;

  const positionen =
    r.positionen && r.positionen.length > 0
      ? r.positionen
      : [{ beschreibung: `Krankenfahrt (${r.abrechnungsart})`, menge: 1, einzelpreis: r.betrag }];

  positionen.forEach((p, i) => {
    const gesamt = p.menge * p.einzelpreis;
    doc.text(String(i + 1), cols.pos, y);
    const beschLines = doc.splitTextToSize(p.beschreibung || "—", 95);
    doc.text(beschLines, cols.besch, y);
    doc.text(String(p.menge), cols.menge, y, { align: "right" });
    doc.text(EUR(p.einzelpreis), cols.einzel, y, { align: "right" });
    doc.text(EUR(gesamt), cols.gesamt, y, { align: "right" });
    y += Math.max(5, beschLines.length * 5);
  });

  // --- Totals ---
  y += 2;
  doc.line(120, y, marginR, y);
  y += 6;
  const n = netto(r);
  const ust = mwstBetrag(r);
  const b = brutto(r);
  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, 145, y, { align: "right" });
    doc.text(value, marginR, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 5.5;
  };
  totalRow("Netto", EUR(n));
  totalRow(`USt (${r.mwstSatz}%)`, EUR(ust));
  totalRow("Gesamtbetrag", EUR(b), true);

  // --- Legal notice ---
  y += 8;
  const modus = steuerModusFuer(r, company);
  doc.setFontSize(8.5);
  const hinweis = doc.splitTextToSize(STEUER_HINWEIS[modus], marginR - marginL);
  doc.text(hinweis, marginL, y);
  y += hinweis.length * 4.5 + 3;

  doc.text(
    doc.splitTextToSize(
      `Bitte überweisen Sie den Gesamtbetrag von ${EUR(b)} bis zum ${formatDatum(r.faelligkeit)}.`,
      marginR - marginL,
    ),
    marginL,
    y,
  );
  y += 8;

  if (r.notiz) {
    doc.setTextColor(90);
    doc.text(doc.splitTextToSize(r.notiz, marginR - marginL), marginL, y);
    doc.setTextColor(0);
    y += 8;
  }

  // --- Footer ---
  doc.setFontSize(7.5);
  doc.setTextColor(140);
  doc.text(STEUER_DISCLAIMER, pageW / 2, 285, { align: "center" });
  doc.setTextColor(0);

  return doc;
}

export function downloadInvoicePdf(r: Rechnung, company: CompanySettings) {
  const doc = generateInvoicePdf(r, company);
  doc.save(`Rechnung-${r.nummer}.pdf`);
}
