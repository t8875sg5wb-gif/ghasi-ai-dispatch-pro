// PDF-Export des Admin-Berichts "Dauerauftrag-Ablehnungen" (jsPDF, clientseitig).
import { jsPDF } from "jspdf";

import type { DauerauftragAblehnung } from "@/lib/recurring-rejections.functions";

export const AKTION_LABEL: Record<string, string> = {
  create: "Neuanlage",
  update: "Änderung",
  delete: "Löschung",
  generate: "Transport-Erzeugung",
};

function formatZeit(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export function generateAblehnungenPdf(
  eintraege: DauerauftragAblehnung[],
  filter: { tage: number },
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginL = 15;
  const marginR = 195;
  const seitenEnde = 282;
  let y = 20;

  const seitenumbruch = (bedarf: number) => {
    if (y + bedarf <= seitenEnde) return;
    doc.addPage();
    y = 20;
  };

  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text("Abgelehnte Daueraufträge", marginL, y);

  y += 6.5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110);
  doc.text(
    `Filter: letzte ${filter.tage} Tage · ${eintraege.length} ${
      eintraege.length === 1 ? "Eintrag" : "Einträge"
    } · Erstellt am ${formatZeit(new Date().toISOString())}`,
    marginL,
    y,
  );
  y += 4.5;
  doc.text("GHASI AI · Admin-Bericht (nur für Administratoren)", marginL, y);
  doc.setTextColor(0);

  y += 8;
  doc.setDrawColor(200);
  doc.line(marginL, y, marginR, y);
  y += 8;

  if (eintraege.length === 0) {
    doc.setFontSize(10);
    doc.text("Keine abgelehnten Dauerauftragsversuche im gewählten Zeitraum.", marginL, y);
    return doc;
  }

  // Top-Gründe als Übersicht
  const gruendeZaehler = new Map<string, number>();
  for (const e of eintraege) gruendeZaehler.set(e.grund, (gruendeZaehler.get(e.grund) ?? 0) + 1);
  const topGruende = [...gruendeZaehler.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Häufigste Ablehnungsgründe", marginL, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.setFontSize(9);
  for (const [grund, anzahl] of topGruende) {
    const zeilen = doc.splitTextToSize(`${anzahl}× ${grund}`, marginR - marginL - 4);
    seitenumbruch(zeilen.length * 4.5 + 2);
    doc.text(zeilen, marginL + 2, y);
    y += zeilen.length * 4.5;
  }

  y += 6;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  seitenumbruch(12);
  doc.text("Protokoll", marginL, y);
  doc.setFont("helvetica", "normal");
  y += 7;

  for (const e of eintraege) {
    seitenumbruch(16);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    const kopf = [
      AKTION_LABEL[e.aktion] ?? e.aktion,
      e.patient ?? "Ohne Patientenbezug",
      formatZeit(e.zeitpunkt),
    ].join(" · ");
    doc.text(kopf, marginL, y);
    doc.setFont("helvetica", "normal");
    y += 4.8;

    doc.setFontSize(9);
    const grundZeilen = doc.splitTextToSize(`Grund: ${e.grund}`, marginR - marginL - 2);
    seitenumbruch(grundZeilen.length * 4.3);
    doc.text(grundZeilen, marginL + 2, y);
    y += grundZeilen.length * 4.3;

    if (e.zielId) {
      seitenumbruch(4.3);
      doc.setTextColor(110);
      doc.text(`Datensatz: ${e.zielId}`, marginL + 2, y);
      doc.setTextColor(0);
      y += 4.3;
    }

    for (const f of e.felder) {
      const fehlerZeilen = doc.splitTextToSize(
        `• ${f.label} (${f.path}): ${f.message}`,
        marginR - marginL - 6,
      );
      seitenumbruch(fehlerZeilen.length * 4.2);
      doc.text(fehlerZeilen, marginL + 4, y);
      y += fehlerZeilen.length * 4.2;
    }

    y += 3.5;
    seitenumbruch(4);
    doc.setDrawColor(230);
    doc.line(marginL, y - 1.5, marginR, y - 1.5);
  }

  const seiten = doc.getNumberOfPages();
  for (let i = 1; i <= seiten; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Seite ${i} von ${seiten}`, marginR, 290, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}
