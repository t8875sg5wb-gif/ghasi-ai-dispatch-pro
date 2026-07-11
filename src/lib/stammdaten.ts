// Zentrale Stammdaten des Krankentransportbetriebs.
// Dient GHASI AI als Unternehmenswissen und der globalen Suche.

export interface Kunde {
  id: string;
  name: string;
  typ: "Krankenkasse" | "Klinik" | "Pflegeeinrichtung" | "Privat" | "Sonstige";
  ansprechpartner: string;
  telefon: string;
  offeneRechnungen: number;
  // Erweiterte, optionale Vertrags- und Abrechnungsdaten
  email?: string;
  adresse?: string;
  vertragsstatus?: "Rahmenvertrag" | "Einzelvertrag" | "Kein Vertrag";
  konditionen?: string;
  zahlungszielTage?: number;
  kreditlimit?: number;
  umsatzJahr?: number;
  notiz?: string;
  aktiv?: boolean;
}

export interface Patient {
  id: string;
  name: string;
  /** Telefonnummer des Patienten/Angehörigen. */
  telefon?: string;
  mobilitaet: "Gehfähig" | "Rollstuhl" | "Liegend";
  kostentraeger: string;
  hinweis: string;
  /** Benötigt der Patient standardmäßig eine Begleitperson? */
  begleitperson?: boolean;
  /** Dauerhafte medizinische Hinweise für Fahrer/Disposition. */
  medizinischeNotiz?: string;
  /** Hinweise zum Patienten (z. B. Kommunikation, Verhalten). */
  patientennotiz?: string;
  // --- Abrechnung & Compliance (§133 SGB V / §4 Nr.17b) ---
  /** Verknüpfung zum Kostenträger (Versicherer) – leer bei Privatzahler. */
  kostentraegerId?: string | null;
  /** Versichertennummer bei der Krankenkasse. */
  versichertennummer?: string;
  /** Von Zuzahlungen befreit? */
  zuzahlungsbefreit?: boolean;
  /** Zuzahlungsbefreiung gültig bis (ISO-Datum). */
  zuzahlungsbefreitBis?: string | null;
  /** Liegt eine gültige ärztliche Verordnung (Muster 4) vor? */
  verordnungVorhanden?: boolean;
  /** Verknüpftes Verordnungs-Dokument. */
  verordnungDokumentId?: string | null;
  /** Patientenbezogene Genehmigung für Dauerfahrten gültig bis (ISO-Datum). */
  genehmigungBis?: string | null;
}

export type EinrichtungTyp = "krankenhaus" | "dialyse" | "pflegeheim";

export interface Einrichtung {
  id: string;
  name: string;
  adresse: string;
  ansprechpartner: string;
  telefon: string;
  // Erweiterte, optionale Felder
  typ?: EinrichtungTyp;
  email?: string;
  fachbereiche?: string[];
  /** Betten/Plätze bzw. Behandlungsplätze */
  kapazitaet?: number;
  oeffnungszeiten?: string;
  /** Verknüpfter Kostenträger/Auftraggeber für Abrechnung */
  kostentraeger?: string;
  notiz?: string;
  aktiv?: boolean;
}

export interface Krankenkasse {
  id: string;
  name: string;
  kuerzel: string;
  vertragsstatus: "Rahmenvertrag" | "Einzelfall";
}

export const KUNDEN: Kunde[] = [
  {
    id: "k-1",
    name: "AOK Nordost",
    typ: "Krankenkasse",
    ansprechpartner: "Frau Berger",
    telefon: "0571 1234500",
    offeneRechnungen: 2,
    email: "abrechnung@aok-nordost.de",
    adresse: "Wilhelmstr. 1, 32427 Minden",
    vertragsstatus: "Rahmenvertrag",
    konditionen: "Festpreis je Transportart laut Rahmenvertrag",
    zahlungszielTage: 30,
    kreditlimit: 50000,
    umsatzJahr: 184500,
    aktiv: true,
  },
  {
    id: "k-2",
    name: "Techniker Krankenkasse",
    typ: "Krankenkasse",
    ansprechpartner: "Herr Daum",
    telefon: "0571 1234501",
    offeneRechnungen: 1,
    email: "leistungen@tk.de",
    adresse: "Bramfelder Str. 140, 22305 Hamburg",
    vertragsstatus: "Rahmenvertrag",
    konditionen: "km-Pauschale + Grundgebühr",
    zahlungszielTage: 30,
    kreditlimit: 40000,
    umsatzJahr: 142300,
    aktiv: true,
  },
  {
    id: "k-3",
    name: "Klinikum West",
    typ: "Klinik",
    ansprechpartner: "Disposition Klinik",
    telefon: "0571 1234502",
    offeneRechnungen: 0,
    email: "transport@klinikum-west.de",
    adresse: "Westring 5, 32425 Minden",
    vertragsstatus: "Einzelvertrag",
    konditionen: "Verlegungsfahrten nach Aufwand",
    zahlungszielTage: 21,
    kreditlimit: 25000,
    umsatzJahr: 96800,
    aktiv: true,
  },
  {
    id: "k-4",
    name: "Pflegeheim Sonnenhof",
    typ: "Pflegeeinrichtung",
    ansprechpartner: "Frau Lang",
    telefon: "0571 1234503",
    offeneRechnungen: 3,
    email: "verwaltung@sonnenhof-pflege.de",
    adresse: "Sonnenweg 3, 32469 Petershagen",
    vertragsstatus: "Einzelvertrag",
    konditionen: "Sammelfahrten zu Festpreisen",
    zahlungszielTage: 14,
    kreditlimit: 15000,
    umsatzJahr: 54200,
    aktiv: true,
  },
  {
    id: "k-5",
    name: "Barmer",
    typ: "Krankenkasse",
    ansprechpartner: "Frau Roth",
    telefon: "0571 1234504",
    offeneRechnungen: 0,
    email: "service@barmer.de",
    adresse: "Axel-Springer-Str. 44, 32423 Minden",
    vertragsstatus: "Rahmenvertrag",
    konditionen: "Festpreis je Transportart laut Rahmenvertrag",
    zahlungszielTage: 30,
    kreditlimit: 35000,
    umsatzJahr: 121400,
    aktiv: true,
  },
];

export const PATIENTEN: Patient[] = [
  {
    id: "p-1",
    name: "Margarete Hoffmann",
    mobilitaet: "Rollstuhl",
    kostentraeger: "AOK Nordost",
    hinweis: "Regelmäßige Dialyse, 3× pro Woche",
    begleitperson: true,
    medizinischeNotiz:
      "Diabetikerin, Unterzuckerung möglich – Traubenzucker im Fahrzeug bereithalten.",
    patientennotiz: "Spricht leise, etwas schwerhörig links.",
  },
  {
    id: "p-2",
    name: "Johann Bauer",
    mobilitaet: "Liegend",
    kostentraeger: "Techniker Krankenkasse",
    hinweis: "Sauerstoffgerät erforderlich",
    begleitperson: false,
    medizinischeNotiz: "Mobiles Sauerstoffgerät muss mitgeführt werden.",
    patientennotiz: "Benötigt ruhige Fahrweise.",
  },
  {
    id: "p-3",
    name: "Elisabeth Wagner",
    mobilitaet: "Gehfähig",
    kostentraeger: "Barmer",
    hinweis: "Begleitperson erlaubt",
    begleitperson: true,
    medizinischeNotiz: "",
    patientennotiz: "Wird häufig von Tochter begleitet.",
  },
  {
    id: "p-4",
    name: "Friedrich Schulz",
    mobilitaet: "Rollstuhl",
    kostentraeger: "DAK Gesundheit",
    hinweis: "Rückfahrt meist separat",
    begleitperson: false,
    medizinischeNotiz: "Faltrollstuhl, passt in jedes geeignete Fahrzeug.",
    patientennotiz: "",
  },
  {
    id: "p-5",
    name: "Anna Klein",
    mobilitaet: "Rollstuhl",
    kostentraeger: "Selbstzahler",
    hinweis: "Tragestuhl erforderlich",
    begleitperson: true,
    medizinischeNotiz: "Tragestuhl für Treppenhaus erforderlich.",
    patientennotiz: "Wohnung im 3. OG ohne Aufzug.",
  },
];

export const KRANKENHAEUSER: Einrichtung[] = [
  {
    id: "kh-1",
    name: "Klinikum West",
    adresse: "Westring 5, 32425 Minden",
    ansprechpartner: "Notaufnahme",
    telefon: "0571 9000100",
    typ: "krankenhaus",
    email: "aufnahme@klinikum-west.de",
    fachbereiche: ["Notaufnahme", "Innere Medizin", "Chirurgie"],
    kapazitaet: 620,
    oeffnungszeiten: "24 h",
    kostentraeger: "Klinikum West",
    notiz: "Anfahrt über Zufahrt Nord, Liegendanlieferung Rampe 2.",
    aktiv: true,
  },
  {
    id: "kh-2",
    name: "Augenklinik Minden",
    adresse: "Mittelstr. 2, 32427 Minden",
    ansprechpartner: "Anmeldung",
    telefon: "0571 9000200",
    typ: "krankenhaus",
    email: "anmeldung@augenklinik-mitte.de",
    fachbereiche: ["Augenheilkunde", "Ambulante OP"],
    kapazitaet: 80,
    oeffnungszeiten: "Mo–Fr 7–19 Uhr",
    notiz: "Patienten nach OP oft sehbeeinträchtigt – Begleitung anbieten.",
    aktiv: true,
  },
  {
    id: "kh-3",
    name: "Reha-Klinik Grunewald",
    adresse: "Waldweg 11, 32549 Bad Oeynhausen",
    ansprechpartner: "Patientenaufnahme",
    telefon: "0571 9000300",
    typ: "krankenhaus",
    email: "aufnahme@reha-grunewald.de",
    fachbereiche: ["Neurologische Reha", "Orthopädie"],
    kapazitaet: 210,
    oeffnungszeiten: "Mo–Sa 8–18 Uhr",
    notiz: "Aufnahme nur mit Kostenzusage.",
    aktiv: true,
  },
];

export const DIALYSEZENTREN: Einrichtung[] = [
  {
    id: "dz-1",
    name: "Dialysezentrum Nord",
    adresse: "Nordstr. 8, 32457 Porta Westfalica",
    ansprechpartner: "Schichtleitung",
    telefon: "0571 9100100",
    typ: "dialyse",
    email: "planung@dialyse-nord.de",
    fachbereiche: ["Hämodialyse"],
    kapazitaet: 36,
    oeffnungszeiten: "Mo/Mi/Fr 6–22 Uhr",
    notiz: "Schichten: 06:30 / 11:30 / 16:30 – Sammeltouren bevorzugt.",
    aktiv: true,
  },
  {
    id: "dz-2",
    name: "Dialysezentrum Süd",
    adresse: "Südallee 20, 32545 Bad Oeynhausen",
    ansprechpartner: "Disposition",
    telefon: "0571 9100200",
    typ: "dialyse",
    email: "disposition@dialyse-sued.de",
    fachbereiche: ["Hämodialyse", "Peritonealdialyse"],
    kapazitaet: 28,
    oeffnungszeiten: "Di/Do/Sa 6–20 Uhr",
    notiz: "Abholung pünktlich, Behandlung ca. 4–5 h.",
    aktiv: true,
  },
];

export const PFLEGEHEIME: Einrichtung[] = [
  {
    id: "ph-1",
    name: "Pflegeheim Sonnenhof",
    adresse: "Sonnenweg 3, 32469 Petershagen",
    ansprechpartner: "Frau Lang",
    telefon: "0571 9200100",
    typ: "pflegeheim",
    email: "verwaltung@sonnenhof-pflege.de",
    fachbereiche: ["Vollstationär", "Kurzzeitpflege"],
    kapazitaet: 120,
    oeffnungszeiten: "24 h",
    kostentraeger: "Pflegeheim Sonnenhof",
    notiz: "Bewohner an Rezeption abmelden, Begleitpapiere mitgeben.",
    aktiv: true,
  },
  {
    id: "ph-2",
    name: "Pflegeheim Lindenhof",
    adresse: "Lindenstr. 14, 32423 Minden",
    ansprechpartner: "Herr Vogel",
    telefon: "0571 9200200",
    typ: "pflegeheim",
    email: "pflege@lindenhof.de",
    fachbereiche: ["Vollstationär", "Demenz-WG"],
    kapazitaet: 95,
    oeffnungszeiten: "24 h",
    notiz: "Aufzug vorhanden, Rollstuhltransporte unkompliziert.",
    aktiv: true,
  },
];

export const KRANKENKASSEN: Krankenkasse[] = [
  { id: "kk-1", name: "AOK Nordost", kuerzel: "AOK", vertragsstatus: "Rahmenvertrag" },
  { id: "kk-2", name: "Techniker Krankenkasse", kuerzel: "TK", vertragsstatus: "Rahmenvertrag" },
  { id: "kk-3", name: "Barmer", kuerzel: "BARMER", vertragsstatus: "Rahmenvertrag" },
  { id: "kk-4", name: "DAK Gesundheit", kuerzel: "DAK", vertragsstatus: "Einzelfall" },
];

/** Erzeugt eine fortlaufende ID mit Präfix (z. B. "k-6"). */
export function nextStammId(prefix: string, vorhandene: { id: string }[]): string {
  let max = 0;
  for (const x of vorhandene) {
    const n = Number(x.id.split("-").pop());
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}-${max + 1}`;
}

export const KUNDEN_TYPEN: Kunde["typ"][] = [
  "Krankenkasse",
  "Klinik",
  "Pflegeeinrichtung",
  "Privat",
  "Sonstige",
];

export const VERTRAGS_STATI: NonNullable<Kunde["vertragsstatus"]>[] = [
  "Rahmenvertrag",
  "Einzelvertrag",
  "Kein Vertrag",
];
