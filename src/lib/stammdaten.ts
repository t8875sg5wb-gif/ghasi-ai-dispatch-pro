// Zentrale Stammdaten des Krankentransportbetriebs.
// Dient GHASI AI als Unternehmenswissen und der globalen Suche.

export interface Kunde {
  id: string;
  name: string;
  typ: "Krankenkasse" | "Klinik" | "Pflegeeinrichtung" | "Privat" | "Sonstige";
  ansprechpartner: string;
  telefon: string;
  offeneRechnungen: number;
}

export interface Patient {
  id: string;
  name: string;
  mobilitaet: "Gehfähig" | "Rollstuhl" | "Liegend";
  kostentraeger: string;
  hinweis: string;
}

export interface Einrichtung {
  id: string;
  name: string;
  adresse: string;
  ansprechpartner: string;
  telefon: string;
}

export interface Krankenkasse {
  id: string;
  name: string;
  kuerzel: string;
  vertragsstatus: "Rahmenvertrag" | "Einzelfall";
}

export const KUNDEN: Kunde[] = [
  { id: "k-1", name: "AOK Nordost", typ: "Krankenkasse", ansprechpartner: "Frau Berger", telefon: "030 1234500", offeneRechnungen: 2 },
  { id: "k-2", name: "Techniker Krankenkasse", typ: "Krankenkasse", ansprechpartner: "Herr Daum", telefon: "030 1234501", offeneRechnungen: 1 },
  { id: "k-3", name: "Klinikum West", typ: "Klinik", ansprechpartner: "Disposition Klinik", telefon: "030 1234502", offeneRechnungen: 0 },
  { id: "k-4", name: "Pflegeheim Sonnenhof", typ: "Pflegeeinrichtung", ansprechpartner: "Frau Lang", telefon: "030 1234503", offeneRechnungen: 3 },
  { id: "k-5", name: "Barmer", typ: "Krankenkasse", ansprechpartner: "Frau Roth", telefon: "030 1234504", offeneRechnungen: 0 },
];

export const PATIENTEN: Patient[] = [
  { id: "p-1", name: "Margarete Hoffmann", mobilitaet: "Rollstuhl", kostentraeger: "AOK Nordost", hinweis: "Regelmäßige Dialyse, 3× pro Woche" },
  { id: "p-2", name: "Johann Bauer", mobilitaet: "Liegend", kostentraeger: "Techniker Krankenkasse", hinweis: "Sauerstoffgerät erforderlich" },
  { id: "p-3", name: "Elisabeth Wagner", mobilitaet: "Gehfähig", kostentraeger: "Barmer", hinweis: "Begleitperson erlaubt" },
  { id: "p-4", name: "Friedrich Schulz", mobilitaet: "Rollstuhl", kostentraeger: "DAK Gesundheit", hinweis: "Rückfahrt meist separat" },
  { id: "p-5", name: "Anna Klein", mobilitaet: "Liegend", kostentraeger: "Selbstzahler", hinweis: "Notfallpatientin" },
];

export const KRANKENHAEUSER: Einrichtung[] = [
  { id: "kh-1", name: "Klinikum West", adresse: "Westring 5, Berlin", ansprechpartner: "Notaufnahme", telefon: "030 9000100" },
  { id: "kh-2", name: "Augenklinik Mitte", adresse: "Mittelstr. 2, Berlin", ansprechpartner: "Anmeldung", telefon: "030 9000200" },
  { id: "kh-3", name: "Reha-Klinik Grunewald", adresse: "Waldweg 11, Berlin", ansprechpartner: "Patientenaufnahme", telefon: "030 9000300" },
];

export const DIALYSEZENTREN: Einrichtung[] = [
  { id: "dz-1", name: "Dialysezentrum Nord", adresse: "Nordstr. 8, Berlin", ansprechpartner: "Schichtleitung", telefon: "030 9100100" },
  { id: "dz-2", name: "Dialysezentrum Süd", adresse: "Südallee 20, Berlin", ansprechpartner: "Disposition", telefon: "030 9100200" },
];

export const PFLEGEHEIME: Einrichtung[] = [
  { id: "ph-1", name: "Pflegeheim Sonnenhof", adresse: "Sonnenweg 3, Berlin", ansprechpartner: "Frau Lang", telefon: "030 9200100" },
  { id: "ph-2", name: "Pflegeheim Lindenhof", adresse: "Lindenstr. 14, Berlin", ansprechpartner: "Herr Vogel", telefon: "030 9200200" },
];

export const KRANKENKASSEN: Krankenkasse[] = [
  { id: "kk-1", name: "AOK Nordost", kuerzel: "AOK", vertragsstatus: "Rahmenvertrag" },
  { id: "kk-2", name: "Techniker Krankenkasse", kuerzel: "TK", vertragsstatus: "Rahmenvertrag" },
  { id: "kk-3", name: "Barmer", kuerzel: "BARMER", vertragsstatus: "Rahmenvertrag" },
  { id: "kk-4", name: "DAK Gesundheit", kuerzel: "DAK", vertragsstatus: "Einzelfall" },
];
