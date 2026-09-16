import { MIDIJOB_OBERGRENZE, MIDIJOB_UNTERGRENZE } from "@/lib/gesetzeswerte";

export const MIDIJOB_FAKTOR_F_2026 = 0.6619 as const;
export const MIDIJOB_UNTERE_GRENZE_2026 = MIDIJOB_UNTERGRENZE.wert;
export const MIDIJOB_OBERE_GRENZE_2026 = MIDIJOB_OBERGRENZE.wert;

const GRENZE = 603;
const OBERGRENZE = 2_000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface MidijobBemessung2026 {
  arbeitsentgelt: number;
  beitragspflichtigeEinnahmeGesamt: number;
  beitragspflichtigeEinnahmeArbeitnehmer: number;
}

/**
 * Amtliche 2026-Bemessungsformeln des Übergangsbereichs (§ 20 Abs. 2 SGB IV).
 * Die Funktion liefert nur die beiden Bemessungsgrundlagen. Die Beiträge sind
 * anschließend je Versicherungszweig mit den individuellen Sätzen zu berechnen.
 */
export function computeMidijobBemessung2026(arbeitsentgelt: number): MidijobBemessung2026 {
  const ae = round2(arbeitsentgelt);
  if (ae < MIDIJOB_UNTERE_GRENZE_2026 || ae > MIDIJOB_OBERE_GRENZE_2026) {
    throw new Error(
      "Arbeitsentgelt liegt außerhalb des Übergangsbereichs 2026 (603,01–2.000,00 €).",
    );
  }

  const gesamt =
    MIDIJOB_FAKTOR_F_2026 * GRENZE +
    (OBERGRENZE / (OBERGRENZE - GRENZE) -
      (GRENZE / (OBERGRENZE - GRENZE)) * MIDIJOB_FAKTOR_F_2026) *
      (ae - GRENZE);
  const arbeitnehmer = (OBERGRENZE / (OBERGRENZE - GRENZE)) * (ae - GRENZE);

  return {
    arbeitsentgelt: ae,
    beitragspflichtigeEinnahmeGesamt: round2(gesamt),
    beitragspflichtigeEinnahmeArbeitnehmer: round2(arbeitnehmer),
  };
}
