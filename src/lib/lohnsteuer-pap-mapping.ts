import type { LohnFakt } from "@/lib/payroll-shared";
import { lohnsteuerPap2026Schema, type LohnsteuerPap2026Input } from "@/lib/lohnsteuer-2026";

export const PAP_2026_DERIVED_INPUTS = ["LZZ", "RE4"] as const;

export type PapFactDefinition = {
  pap: keyof LohnsteuerPap2026Input;
  faktSchluessel: string;
  label: string;
};

// Bewusst explizit: Ein verifiziertes "0" ist ein Wert; ein fehlender Fakt ist unbekannt.
export const PAP_2026_FACT_MAPPING: readonly PapFactDefinition[] = [
  { pap: "af", faktSchluessel: "pap_af", label: "Faktorverfahren gewählt (0/1)" },
  { pap: "AJAHR", faktSchluessel: "pap_ajahr", label: "Jahr nach Vollendung des 64. Lebensjahres" },
  { pap: "ALTER1", faktSchluessel: "pap_alter1", label: "Altersentlastungs-Merker (0/1)" },
  { pap: "ALV", faktSchluessel: "pap_alv", label: "ALV-Merker Vorsorgepauschale (0/1)" },
  { pap: "f", faktSchluessel: "pap_faktor", label: "Faktor Steuerklasse IV" },
  { pap: "JFREIB", faktSchluessel: "pap_jfreib_cent", label: "Jahresfreibetrag in Cent" },
  { pap: "JHINZU", faktSchluessel: "pap_jhinzu_cent", label: "Jahreshinzurechnungsbetrag in Cent" },
  {
    pap: "JRE4",
    faktSchluessel: "pap_jre4_cent",
    label: "Voraussichtlicher Jahresarbeitslohn in Cent",
  },
  {
    pap: "JRE4ENT",
    faktSchluessel: "pap_jre4ent_cent",
    label: "In JRE4 enthaltene Entschädigungen in Cent",
  },
  {
    pap: "JVBEZ",
    faktSchluessel: "pap_jvbez_cent",
    label: "In JRE4 enthaltene Versorgungsbezüge in Cent",
  },
  { pap: "KRV", faktSchluessel: "pap_krv", label: "Rentenversicherungs-Merker (0/1)" },
  {
    pap: "KVZ",
    faktSchluessel: "pap_kvz_prozent",
    label: "Kassenindividueller Zusatzbeitrag in %",
  },
  {
    pap: "LZZFREIB",
    faktSchluessel: "pap_lzzfreib_cent",
    label: "Freibetrag Lohnzahlungszeitraum in Cent",
  },
  {
    pap: "LZZHINZU",
    faktSchluessel: "pap_lzzhinzu_cent",
    label: "Hinzurechnungsbetrag Lohnzahlungszeitraum in Cent",
  },
  {
    pap: "MBV",
    faktSchluessel: "pap_mbv_cent",
    label: "Nicht zu besteuernde Vermögensbeteiligungen in Cent",
  },
  {
    pap: "PKPV",
    faktSchluessel: "pap_pkpv_cent",
    label: "Private Basis-KV/PV Monatsbeitrag in Cent",
  },
  {
    pap: "PKPVAGZ",
    faktSchluessel: "pap_pkpvagz_cent",
    label: "Arbeitgeberzuschuss private KV/PV in Cent",
  },
  { pap: "PKV", faktSchluessel: "pap_pkv", label: "Krankenversicherung gesetzlich/privat (0/1)" },
  { pap: "PVA", faktSchluessel: "pap_pva", label: "PV-Beitragsabschläge für Kinder" },
  { pap: "PVS", faktSchluessel: "pap_pvs", label: "Pflegeversicherung Sachsen (0/1)" },
  { pap: "PVZ", faktSchluessel: "pap_pvz", label: "PV-Kinderlosenzuschlag (0/1)" },
  { pap: "R", faktSchluessel: "pap_religion", label: "Religionsmerkmal nach ELStAM" },
  { pap: "SONSTB", faktSchluessel: "pap_sonstb_cent", label: "Sonstige Bezüge in Cent" },
  {
    pap: "SONSTENT",
    faktSchluessel: "pap_sonstent_cent",
    label: "Entschädigungen in sonstigen Bezügen in Cent",
  },
  {
    pap: "STERBE",
    faktSchluessel: "pap_sterbe_cent",
    label: "Sterbegeld/Kapitalauszahlungen in Cent",
  },
  { pap: "STKL", faktSchluessel: "steuerklasse", label: "Steuerklasse I–VI" },
  {
    pap: "VBEZ",
    faktSchluessel: "pap_vbez_cent",
    label: "Versorgungsbezüge im laufenden Arbeitslohn in Cent",
  },
  {
    pap: "VBEZM",
    faktSchluessel: "pap_vbezm_cent",
    label: "Versorgungsbezug erster voller Monat in Cent",
  },
  {
    pap: "VBEZS",
    faktSchluessel: "pap_vbezs_cent",
    label: "Voraussichtliche Versorgungs-Sonderzahlungen in Cent",
  },
  {
    pap: "VBS",
    faktSchluessel: "pap_vbs_cent",
    label: "Versorgungsbezüge in sonstigen Bezügen in Cent",
  },
  { pap: "VJAHR", faktSchluessel: "pap_vjahr", label: "Jahr des erstmaligen Versorgungsbezugs" },
  { pap: "ZKF", faktSchluessel: "kinderfreibetraege", label: "Kinderfreibeträge" },
  { pap: "ZMVB", faktSchluessel: "pap_zmvb", label: "Monate mit Versorgungsbezügen" },
] as const;

export type PapMappingIssue = { faktSchluessel: string; pap: string; grund: string };
export type PapMappingResult =
  | { status: "bereit"; input: LohnsteuerPap2026Input; probleme: [] }
  | { status: "unvollstaendig"; input: null; probleme: PapMappingIssue[] };

const INTEGER_PAP = new Set<keyof LohnsteuerPap2026Input>([
  "af",
  "AJAHR",
  "ALTER1",
  "ALV",
  "JFREIB",
  "JHINZU",
  "JRE4",
  "JRE4ENT",
  "JVBEZ",
  "KRV",
  "LZZ",
  "LZZFREIB",
  "LZZHINZU",
  "MBV",
  "PKPV",
  "PKPVAGZ",
  "PKV",
  "PVA",
  "PVS",
  "PVZ",
  "R",
  "RE4",
  "SONSTB",
  "SONSTENT",
  "STERBE",
  "STKL",
  "VBEZ",
  "VBEZM",
  "VBEZS",
  "VBS",
  "VJAHR",
  "ZMVB",
]);

function monatsZeitraum(monat: string): { ab: string; bis: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monat)) return null;
  const [jahr, m] = monat.split("-").map(Number);
  const letzter = new Date(Date.UTC(jahr, m, 0)).getUTCDate();
  return { ab: `${monat}-01`, bis: `${monat}-${String(letzter).padStart(2, "0")}` };
}

function deckt(f: LohnFakt, ab: string, bis: string): boolean {
  return f.gueltigAb <= ab && (f.gueltigBis === null || f.gueltigBis >= bis);
}

function parsePapWert(pap: keyof LohnsteuerPap2026Input, raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const wert = Number(normalized);
  if (!Number.isFinite(wert)) return null;
  if (INTEGER_PAP.has(pap) && !Number.isInteger(wert)) return null;
  return wert;
}
export function mappeLohnfaktenZuPap2026(args: {
  monat: string;
  fahrerId: string;
  bruttoEuro: number;
  fakten: LohnFakt[];
}): PapMappingResult {
  const zeitraum = monatsZeitraum(args.monat);
  const probleme: PapMappingIssue[] = [];
  if (!zeitraum) {
    return {
      status: "unvollstaendig",
      input: null,
      probleme: [{ faktSchluessel: "monat", pap: "LZZ", grund: "Monat muss YYYY-MM sein." }],
    };
  }
  if (!Number.isFinite(args.bruttoEuro) || args.bruttoEuro < 0) {
    return {
      status: "unvollstaendig",
      input: null,
      probleme: [
        { faktSchluessel: "brutto", pap: "RE4", grund: "Bruttolohn fehlt oder ist ungültig." },
      ],
    };
  }

  const input: Record<string, number> = {
    LZZ: 2,
    RE4: Math.round(args.bruttoEuro * 100),
  };

  for (const def of PAP_2026_FACT_MAPPING) {
    const passend = args.fakten.filter(
      (f) =>
        f.fahrerId === args.fahrerId &&
        f.status === "verifiziert" &&
        f.faktSchluessel === def.faktSchluessel &&
        deckt(f, zeitraum.ab, zeitraum.bis),
    );
    if (passend.length === 0) {
      probleme.push({
        faktSchluessel: def.faktSchluessel,
        pap: String(def.pap),
        grund: `Verifizierter Fakt fehlt: ${def.label}.`,
      });
      continue;
    }
    if (passend.length > 1) {
      probleme.push({
        faktSchluessel: def.faktSchluessel,
        pap: String(def.pap),
        grund: `Mehrere verifizierte Fakten decken denselben Monat ab: ${def.label}.`,
      });
      continue;
    }
    const wert = parsePapWert(def.pap, passend[0]!.wert);
    if (wert === null) {
      probleme.push({
        faktSchluessel: def.faktSchluessel,
        pap: String(def.pap),
        grund: `Ungültiger Wert für ${def.label}: „${passend[0]!.wert}“.`,
      });
      continue;
    }
    input[String(def.pap)] = wert;
  }

  if (probleme.length > 0) return { status: "unvollstaendig", input: null, probleme };

  const parsed = lohnsteuerPap2026Schema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "unvollstaendig",
      input: null,
      probleme: parsed.error.issues.map((issue) => ({
        faktSchluessel: String(issue.path[0] ?? "pap"),
        pap: String(issue.path[0] ?? "PAP"),
        grund: issue.message,
      })),
    };
  }
  return { status: "bereit", input: parsed.data, probleme: [] };
}
