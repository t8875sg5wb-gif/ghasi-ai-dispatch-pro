import { z } from "zod";
import { calculate, type LohnsteuerInputs, type LohnsteuerOutputs } from "lohnsteuerrechner";

const cent = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const bit = z.union([z.literal(0), z.literal(1)]);
const jahrOderNull = z.number().int().min(0).max(2200);

/**
 * Vollstaendige PAP-Eingabe: kein stilles Uebernehmen von Paket-Defaults.
 * Eine aufrufende GHASI-Seite muss jeden relevanten Wert explizit liefern.
 */
export const lohnsteuerPap2026Schema = z
  .object({
    af: bit,
    AJAHR: jahrOderNull,
    ALTER1: bit,
    ALV: bit,
    f: z.number().min(0).max(1),
    JFREIB: cent,
    JHINZU: cent,
    JRE4: cent,
    JRE4ENT: cent,
    JVBEZ: cent,
    KRV: bit,
    KVZ: z.number().min(0).max(20),
    LZZ: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    LZZFREIB: cent,
    LZZHINZU: cent,
    MBV: cent,
    PKPV: cent,
    PKPVAGZ: cent,
    PKV: bit,
    PVA: z.number().int().min(0).max(4),
    PVS: bit,
    PVZ: bit,
    R: bit,
    RE4: cent,
    SONSTB: cent,
    SONSTENT: cent,
    STERBE: cent,
    STKL: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
    VBEZ: cent,
    VBEZM: cent,
    VBEZS: cent,
    VBS: cent,
    VJAHR: jahrOderNull,
    ZKF: z.number().min(0).max(99).multipleOf(0.5),
    ZMVB: z.number().int().min(0).max(12),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.ALTER1 === 1 && v.AJAHR === 0) {
      ctx.addIssue({ code: "custom", path: ["AJAHR"], message: "AJAHR fehlt bei ALTER1=1." });
    }
    if (v.PKV === 1 && v.PKPV === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["PKPV"],
        message: "Bei privater KV muss der Basisbeitrag explizit angegeben werden.",
      });
    }
    if (v.STKL !== 4 && v.af === 1 && v.f !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["f"],
        message: "Ein Faktor darf nur bei Steuerklasse IV angewendet werden.",
      });
    }
  });

export type LohnsteuerPap2026Input = z.infer<typeof lohnsteuerPap2026Schema>;
const outputSchema = z
  .object({
    BK: cent,
    BKS: cent,
    LSTLZZ: cent,
    SOLZLZZ: cent,
    SOLZS: cent,
    STS: cent,
    VFRB: cent,
    VFRBS1: cent,
    VFRBS2: cent,
    WVFRB: cent,
    WVFRBO: cent,
    WVFRBM: cent,
  })
  .strict();

export type LohnsteuerPap2026Output = z.infer<typeof outputSchema>;

export const LOHNSTEUER_2026_REFERENZ = {
  amtlicherAlgorithmus: "BMF Programmablaufplan Lohnsteuer 2026, Version 1.0",
  papStand: "2025-11-12",
  runtimeImplementierung: "lohnsteuerrechner@1.0.7 (Drittanbieter, MIT)",
  verifiziertAm: "2026-09-14",
  qualitaetstest:
    "30 synthetische Faelle: BMF-Testschnittstelle, aus offizieller BMF-XML erzeugte Referenz und Drittanbieter-Runtime identisch.",
  nichtDurchgefuehrt: "Keine dokumentierten DATEV-/WISO-/Lexware-Black-Box-Laeufe.",
} as const;
export const LOHNSTEUER_2026_INPUT_NAMES = [
  "af",
  "AJAHR",
  "ALTER1",
  "ALV",
  "f",
  "JFREIB",
  "JHINZU",
  "JRE4",
  "JRE4ENT",
  "JVBEZ",
  "KRV",
  "KVZ",
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
  "ZKF",
  "ZMVB",
] as const satisfies readonly (keyof LohnsteuerInputs)[];

export function berechneLohnsteuerPap2026(input: LohnsteuerPap2026Input): LohnsteuerPap2026Output {
  const parsed = lohnsteuerPap2026Schema.parse(input);
  const raw: LohnsteuerOutputs = calculate(2026, parsed);
  return outputSchema.parse(raw);
}

export function centZuEuro(centWert: number): number {
  if (!Number.isSafeInteger(centWert))
    throw new Error("Cent-Wert muss eine sichere Ganzzahl sein.");
  return centWert / 100;
}
