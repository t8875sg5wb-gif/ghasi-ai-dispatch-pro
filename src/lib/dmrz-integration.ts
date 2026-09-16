export const DMRZ_INTEGRATION_STATUS = "spezifikation_ausstehend" as const;

export const DMRZ_ERLAUBTE_VORBEREITUNG = [
  "interne Fahrtdaten auf Vollstaendigkeit pruefen",
  "einen noch nicht uebertragbaren Abrechnungsentwurf vorbereiten",
  "Doppeleingaben und Abweichungen intern markieren",
] as const;

export const DMRZ_GESPERRTE_AKTIONEN = [
  "Daten an DMRZ uebertragen",
  "DMRZ-Feldnamen oder Codes erfinden",
  "DMRZ-Preise oder Vertragspositionen berechnen",
  "eine Abrechnung ohne menschliche Freigabe abschliessen",
] as const;

export interface DmrzFreigabeVoraussetzungen {
  offizielleTechnischeSpezifikationVerifiziert: boolean;
  menschlicheUnternehmerfreigabe: boolean;
}
export function dmrzUebertragungFreigegeben(voraussetzungen: DmrzFreigabeVoraussetzungen): boolean {
  return (
    voraussetzungen.offizielleTechnischeSpezifikationVerifiziert &&
    voraussetzungen.menschlicheUnternehmerfreigabe
  );
}

export function dmrzSperrgruende(voraussetzungen: DmrzFreigabeVoraussetzungen): string[] {
  const gruende: string[] = [];
  if (!voraussetzungen.offizielleTechnischeSpezifikationVerifiziert) {
    gruende.push("Offizielle technische DMRZ-Spezifikation fehlt oder ist nicht verifiziert.");
  }
  if (!voraussetzungen.menschlicheUnternehmerfreigabe) {
    gruende.push("Menschliche Unternehmerfreigabe fehlt.");
  }
  return gruende;
}
