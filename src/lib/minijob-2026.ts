import { MINIJOB_GRENZE_MONAT, MINIJOB_PAUSCHALEN_2026 } from "@/lib/gesetzeswerte";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type MinijobSteuerart = "pauschal_2" | "individuell";

export interface Minijob2026Eingabe {
  brutto: number;
  gesetzlichKrankenversichert: boolean;
  rvBefreit: boolean;
  mindestRvBemessung175Anwenden: boolean;
  u1Pflichtig: boolean;
  u2Pflichtig: boolean;
  insolvenzgeldPflichtig: boolean;
  steuerart: MinijobSteuerart;
  /** Individueller UV-Satz; null bedeutet: Gesamtkosten noch nicht vollständig. */
  unfallversicherungProzent: number | null;
}

export interface Minijob2026Ergebnis {
  brutto: number;
  innerhalbVerdienstgrenze: boolean;
  arbeitgeberKv: number;
  arbeitgeberRv: number;
  arbeitnehmerRv: number;
  u1: number;
  u2: number;
  insolvenzgeld: number;
  pauschsteuer: number | null;
  unfallversicherung: number | null;
  arbeitgeberAbgabenOhneUv: number;
  arbeitgeberGesamt: number | null;
  nettoVorIndividuellerSteuer: number;
  vollstaendig: boolean;
  fehlendePunkte: string[];
}
export function computeMinijob2026(e: Minijob2026Eingabe): Minijob2026Ergebnis {
  const brutto = round2(Math.max(0, e.brutto));
  const fehlt: string[] = [];
  const arbeitgeberKv = e.gesetzlichKrankenversichert
    ? round2(brutto * (MINIJOB_PAUSCHALEN_2026.kv / 100))
    : 0;
  const arbeitgeberRv = round2(brutto * (MINIJOB_PAUSCHALEN_2026.rv / 100));

  let arbeitnehmerRv = 0;
  if (!e.rvBefreit) {
    if (e.mindestRvBemessung175Anwenden && brutto < 175) {
      const vollerMindestbeitrag = round2(175 * 0.186);
      arbeitnehmerRv = round2(Math.max(0, vollerMindestbeitrag - arbeitgeberRv));
    } else {
      arbeitnehmerRv = round2(brutto * 0.036);
    }
  }

  const u1 = e.u1Pflichtig ? round2(brutto * (MINIJOB_PAUSCHALEN_2026.u1 / 100)) : 0;
  const u2 = e.u2Pflichtig ? round2(brutto * (MINIJOB_PAUSCHALEN_2026.u2 / 100)) : 0;
  const insolvenzgeld = e.insolvenzgeldPflichtig
    ? round2(brutto * (MINIJOB_PAUSCHALEN_2026.insolvenzgeld / 100))
    : 0;
  const pauschsteuer =
    e.steuerart === "pauschal_2" ? round2(brutto * (MINIJOB_PAUSCHALEN_2026.steuer / 100)) : null;
  if (e.steuerart === "individuell") {
    fehlt.push("Individuelle Lohnsteuer muss über den BMF-PAP 2026 berechnet werden.");
  }

  const unfallversicherung =
    e.unfallversicherungProzent === null
      ? null
      : round2(brutto * (Math.max(0, e.unfallversicherungProzent) / 100));
  if (unfallversicherung === null) {
    fehlt.push("Individueller Beitragssatz der gesetzlichen Unfallversicherung fehlt.");
  }

  const arbeitgeberAbgabenOhneUv = round2(
    arbeitgeberKv + arbeitgeberRv + u1 + u2 + insolvenzgeld + (pauschsteuer ?? 0),
  );
  const arbeitgeberGesamt =
    unfallversicherung === null
      ? null
      : round2(brutto + arbeitgeberAbgabenOhneUv + unfallversicherung);

  return {
    brutto,
    innerhalbVerdienstgrenze: brutto <= MINIJOB_GRENZE_MONAT.wert,
    arbeitgeberKv,
    arbeitgeberRv,
    arbeitnehmerRv,
    u1,
    u2,
    insolvenzgeld,
    pauschsteuer,
    unfallversicherung,
    arbeitgeberAbgabenOhneUv,
    arbeitgeberGesamt,
    nettoVorIndividuellerSteuer: round2(brutto - arbeitnehmerRv),
    vollstaendig: fehlt.length === 0,
    fehlendePunkte: fehlt,
  };
}
