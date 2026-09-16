// GHASI AI — zentrale Rechen-Prüfarchitektur.
//
// Rechnen bleibt deterministisch. KI-Agenten dürfen Quellen vergleichen,
// Abweichungen erklären und Testfälle erzeugen, aber niemals Rechtswerte,
// Preise oder Formeln erfinden. Amtliche Quellen schlagen Hersteller-/
// Black-Box-Vergleiche.

export const RECHEN_PRUEFSTICHTAG = "2026-09-14" as const;

export type Belegstufe = "A_AMTLICH" | "B_HERSTELLER" | "C_BLACKBOX";
export type RechenStatus = "gruen" | "gelb" | "gesperrt";

export interface RechenQuelle {
  name: string;
  stufe: Belegstufe;
  url: string;
  verifiziertAm: string;
  hinweis?: string;
}

export interface RechenAgent {
  id: string;
  name: string;
  zweck: string;
  status: RechenStatus;
  statusGrund: string;
  quellen: RechenQuelle[];
  vergleichssysteme: string[];
}
const q = (name: string, stufe: Belegstufe, url: string, hinweis?: string): RechenQuelle => ({
  name,
  stufe,
  url,
  verifiziertAm: RECHEN_PRUEFSTICHTAG,
  ...(hinweis ? { hinweis } : {}),
});

export const RECHEN_AGENTEN: RechenAgent[] = [
  {
    id: "lohnsteuer",
    name: "Lohnsteuer-Agent",
    zweck: "Lohnsteuer, Soli und Kirchenlohnsteuer gegen den BMF-PAP 2026 prüfen.",
    status: "gelb",
    statusGrund:
      "Amtliche Grundlage ist der BMF-PAP 2026. Die Runtime ist die Drittanbieter-Implementierung lohnsteuerrechner@1.0.7; 30 synthetische Fälle stimmten mit BMF-Testschnittstelle und einer aus der offiziellen BMF-XML erzeugten Referenz überein. Das 35-Felder-Mapping ist jetzt explizit prüfbar, bleibt aber pro Mitarbeiter fail-closed, bis alle 33 Fakten verifiziert vorliegen. DATEV/WISO/Lexware wurden nicht dokumentiert ausgeführt.",
    quellen: [
      q(
        "BMF Programmablaufplan Lohnsteuer 2026",
        "A_AMTLICH",
        "https://www.bundesfinanzministerium.de/Datenportal/Daten/frei-nutzbare-produkte/Anwendungen/Programmablaufplan-2026/Programmablaufplan-2026.html",
      ),
    ],
    vergleichssysteme: [
      "WISO Lohn & Gehalt",
      "DATEV Lohn und Gehalt",
      "Lexware lohn+gehalt",
      "AOK Gehaltsrechner",
    ],
  },
  {
    id: "minijob",
    name: "Minijob-Agent",
    zweck: "603-Euro-Grenze, RV, KV-Pauschale, Umlagen, Steuer und Arbeitgeberkosten prüfen.",
    status: "gruen",
    statusGrund: "Amtliche 2026-Werte und ein deterministischer Rechenkern sind hinterlegt.",
    quellen: [
      q(
        "Minijob-Zentrale – Rechner und Abgaben 2026",
        "A_AMTLICH",
        "https://www.minijob-zentrale.de/DE/fuer-gewerbetreibende/minijob-rechner",
      ),
    ],
    vergleichssysteme: ["Minijob-Zentrale Rechner", "AOK Gehaltsrechner", "Lexware lohn+gehalt"],
  },
  {
    id: "midijob",
    name: "Midijob-Agent",
    zweck: "Übergangsbereich und beitragspflichtige Einnahmen nach der 2026-Formel prüfen.",
    status: "gelb",
    statusGrund:
      "Die amtliche Bemessungsformel ist integriert; exakte Nettoabrechnung benötigt zusätzlich die individuellen KV/PV-/Steuerdaten.",
    quellen: [
      q(
        "Deutsche Rentenversicherung – Übergangsbereich 2026",
        "A_AMTLICH",
        "https://www.deutsche-rentenversicherung.de/DRV/DE/Experten/Arbeitgeber-und-Steuerberater/summa-summarum/Lexikon/U/uebergangsbereich",
      ),
    ],
    vergleichssysteme: ["AOK Gehaltsrechner", "DATEV", "Lexware"],
  },
  {
    id: "einkommensteuer-soli",
    name: "Einkommensteuer-/Soli-Agent",
    zweck: "§ 32a EStG 2026 und SolzG mit amtlichen Rundungs- und Milderungsregeln prüfen.",
    status: "gruen",
    statusGrund:
      "Der Tarif ist für ein vorgegebenes zu versteuerndes Einkommen deterministisch; persönliche Steuerermittlung bleibt davon getrennt.",
    quellen: [
      q("§ 32a EStG", "A_AMTLICH", "https://www.gesetze-im-internet.de/estg/__32a.html"),
      q("§§ 3, 4 SolzG", "A_AMTLICH", "https://www.gesetze-im-internet.de/solzg_1995/__3.html"),
    ],
    vergleichssysteme: ["BMF Einkommensteuerrechner", "WISO Steuer", "smartsteuer"],
  },
  {
    id: "umsatzsteuer",
    name: "Umsatzsteuer-Agent",
    zweck: "Steuersatz und § 4 Nr. 17b UStG je konkreter Leistung/Fahrzeugkonstellation prüfen.",
    status: "gelb",
    statusGrund:
      "§ 4 Nr. 17b ist fallbezogen; Transportart allein darf die Befreiung nicht automatisch festlegen.",
    quellen: [
      q("§ 4 Nr. 17b UStG", "A_AMTLICH", "https://www.gesetze-im-internet.de/ustg_1980/__4.html"),
    ],
    vergleichssysteme: ["WISO MeinBüro", "DATEV", "Lexware"],
  },
  {
    id: "gewerbesteuer",
    name: "Gewerbesteuer-Agent",
    zweck: "Messzahl, Freibetrag, Hebesatz Minden und § 35-EStG-Anrechnung prüfen.",
    status: "gelb",
    statusGrund:
      "Formeln sind amtlich; der echte Gewerbeertrag benötigt Hinzurechnungen/Kürzungen und bleibt ohne Steuerdaten eine Schätzung.",
    quellen: [
      q("§ 11 GewStG", "A_AMTLICH", "https://www.gesetze-im-internet.de/gewstg/__11.html"),
      q("§ 35 EStG", "A_AMTLICH", "https://www.gesetze-im-internet.de/estg/__35.html"),
      q(
        "Stadt Minden – Realsteuerhebesatz-Satzung 2026",
        "A_AMTLICH",
        "https://www.minden.de/dokumente/satzungen/steuern/2.3-realsteuerhebesatz-satzung.pdf",
      ),
    ],
    vergleichssysteme: ["WISO Steuer", "smartsteuer", "DATEV"],
  },
  {
    id: "krankentransport-abrechnung",
    name: "Krankenfahrten-Abrechnungs-Agent",
    zweck: "Kassenvertrag, Preis, Zuzahlung und DMRZ-Übergabe prüfen, ohne DMRZ nachzubauen.",
    status: "gesperrt",
    statusGrund:
      "Echte DMRZ-Übertragung bleibt bis zur vollständigen offiziellen technischen DMRZ-Spezifikation gesperrt.",
    quellen: [
      q("§ 133 SGB V", "A_AMTLICH", "https://www.gesetze-im-internet.de/sgb_5/__133.html"),
      q("DMRZ Krankentransport", "B_HERSTELLER", "https://www.dmrz.de/fuer-wen/krankentransport"),
    ],
    vergleichssysteme: ["DMRZ", "opta data"],
  },
  {
    id: "zuzahlung",
    name: "Zuzahlungs-Agent",
    zweck: "Patientenzuzahlung nach § 61 SGB V stichtagsgenau prüfen.",
    status: "gruen",
    statusGrund: "Für 2026 gilt die amtliche 10-%-/5-€/10-€-Regel; 2027 wird getrennt versioniert.",
    quellen: [q("§ 61 SGB V", "A_AMTLICH", "https://www.gesetze-im-internet.de/sgb_5/__61.html")],
    vergleichssysteme: ["DMRZ", "Kassen-/Branchenrechner"],
  },
  {
    id: "rechnung-xrechnung",
    name: "Rechnungs-/XRechnung-Agent",
    zweck: "Rechenbeträge, Pflichtfelder und EN-16931/XRechnung-Export prüfen.",
    status: "gelb",
    statusGrund:
      "Der Generator-Referenzfall wurde mit KoSIT Validator 1.6.3 / XRechnung 3.0.2 erfolgreich validiert; konkrete Produktivdateien werden nicht automatisch individuell durch KoSIT gepr?ft.",
    quellen: [q("KoSIT XRechnung", "A_AMTLICH", "https://xeinkauf.de/xrechnung/")],
    vergleichssysteme: [
      "KoSIT Validator (Referenzlauf durchgef?hrt)",
      "DATEV (geplant)",
      "Lexware (geplant)",
    ],
  },
  {
    id: "euer-jahresabschluss",
    name: "EÜR-/Jahresabschluss-Agent",
    zweck: "EÜR-Zuordnung, Steuer-Schätzungen, Fristen und Jahreswerte gegentesten.",
    status: "gelb",
    statusGrund:
      "EÜR-Zuordnung ist deterministisch; persönliche Steuer-/Erklärungswerte benötigen vollständige Steuerdaten.",
    quellen: [
      q(
        "BMF / EStG",
        "A_AMTLICH",
        "https://www.bundesfinanzministerium.de/Web/DE/Themen/Steuern/Steuern.html",
      ),
    ],
    vergleichssysteme: ["WISO Steuer", "smartsteuer", "ELSTER-Plausibilitätsprüfung"],
  },
  {
    id: "fahrzeug-kosten",
    name: "Fahrzeugkosten-Agent",
    zweck: "Leasing, Kraftstoff, Wartung, AfA und Kilometerkosten mit belegten Parametern prüfen.",
    status: "gelb",
    statusGrund:
      "Betriebswerte sind individuell; ohne belegte Laufleistung, Verträge und Kosten darf nichts geschätzt als exakt ausgegeben werden.",
    quellen: [],
    vergleichssysteme: ["DATEV", "Lexware", "WISO MeinBüro"],
  },
  {
    id: "mahnung-zinsen",
    name: "Mahn-/Zins-Agent",
    zweck: "Teilzahlungen, Fälligkeit, Verzugszins und Mahnbetrag stichtagsgenau prüfen.",
    status: "gelb",
    statusGrund:
      "Mahnlogik ist vorhanden; gesetzliche Zinsen/Basiszinssatz brauchen stichtagsbezogene Versionierung.",
    quellen: [q("§ 288 BGB", "A_AMTLICH", "https://www.gesetze-im-internet.de/bgb/__288.html")],
    vergleichssysteme: ["DATEV", "Lexware"],
  },
  {
    id: "arbeitszeit-zuschlaege",
    name: "Arbeitszeit-/Zuschlags-Agent",
    zweck: "Arbeitsstunden, Mindestlohn, Zuschläge, Urlaub/Krankheit und Lohnbasis prüfen.",
    status: "gelb",
    statusGrund:
      "Mindestlohn ist amtlich; konkrete Zuschläge können tarif-/arbeitsvertraglich und steuerlich unterschiedlich sein.",
    quellen: [
      q(
        "BMAS Mindestlohn 2026",
        "A_AMTLICH",
        "https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Mindestlohn/mindestlohn.html",
      ),
    ],
    vergleichssysteme: ["DATEV", "Lexware", "WISO Lohn & Gehalt"],
  },
];
export interface SeitenRechenAgent {
  id: string;
  route: string;
  label: string;
  fachAgentId: RechenAgent["id"];
}

/**
 * Jede Seite mit fachlicher Rechenlogik bekommt einen eigenen Seiten-Agenten.
 * Er delegiert an genau einen Fach-Agenten; dadurch bleibt die Formel zentral.
 */
export const RECHEN_SEITEN_AGENTEN: SeitenRechenAgent[] = [
  { id: "seite-lohn", route: "/lohn", label: "Lohn-Rechner", fachAgentId: "lohnsteuer" },
  { id: "seite-lohnlaeufe", route: "/lohn-laeufe", label: "Lohnläufe", fachAgentId: "lohnsteuer" },
  {
    id: "seite-lohnregeln",
    route: "/lohn-regelwerke",
    label: "Lohn-Regelwerke",
    fachAgentId: "arbeitszeit-zuschlaege",
  },
  {
    id: "seite-rechnungen",
    route: "/rechnungen",
    label: "Rechnungen",
    fachAgentId: "rechnung-xrechnung",
  },
  { id: "seite-euer", route: "/euer", label: "EÜR", fachAgentId: "euer-jahresabschluss" },
  {
    id: "seite-jahresabschluss",
    route: "/jahresabschluss",
    label: "Jahresabschluss",
    fachAgentId: "euer-jahresabschluss",
  },
  {
    id: "seite-buchhaltung",
    route: "/buchhaltung",
    label: "Buchhaltung",
    fachAgentId: "euer-jahresabschluss",
  },
  { id: "seite-ceo", route: "/ceo-cockpit", label: "CEO Cockpit", fachAgentId: "gewerbesteuer" },
  {
    id: "seite-kassenvertraege",
    route: "/kassenvertraege",
    label: "Kassenverträge",
    fachAgentId: "krankentransport-abrechnung",
  },
  { id: "seite-ausgaben", route: "/ausgaben", label: "Ausgaben", fachAgentId: "umsatzsteuer" },
  { id: "seite-leasing", route: "/leasing", label: "Leasing", fachAgentId: "fahrzeug-kosten" },
  {
    id: "seite-fahrzeuge",
    route: "/fahrzeuge",
    label: "Fahrzeuge",
    fachAgentId: "fahrzeug-kosten",
  },
  {
    id: "seite-fahrtenbuch",
    route: "/fahrtenbuch",
    label: "Fahrtenbuch",
    fachAgentId: "fahrzeug-kosten",
  },
  {
    id: "seite-compliance",
    route: "/compliance",
    label: "Compliance",
    fachAgentId: "arbeitszeit-zuschlaege",
  },
  {
    id: "seite-verbindungen-dmrz",
    route: "/verbindungen",
    label: "DMRZ",
    fachAgentId: "krankentransport-abrechnung",
  },
];

export function fachAgent(id: string): RechenAgent | undefined {
  return RECHEN_AGENTEN.find((a) => a.id === id);
}

export function seitenAgent(route: string): SeitenRechenAgent | undefined {
  return RECHEN_SEITEN_AGENTEN.find((a) => a.route === route);
}

export interface ReferenzErgebnis {
  quelle: string;
  stufe: Belegstufe;
  wert: number;
}

export type Vergleichsstatus =
  | "bestaetigt"
  | "amtlich_bestaetigt"
  | "abweichung"
  | "nicht_verifiziert";

export interface Vergleichsergebnis {
  status: Vergleichsstatus;
  maximaleAbweichung: number | null;
  abweichendeQuellen: string[];
}

export function vergleicheRechenwert(
  ghasiWert: number,
  referenzen: ReferenzErgebnis[],
  toleranz = 0.01,
): Vergleichsergebnis {
  const amtlich = referenzen.filter((r) => r.stufe === "A_AMTLICH");
  if (amtlich.length === 0) {
    return { status: "nicht_verifiziert", maximaleAbweichung: null, abweichendeQuellen: [] };
  }
  const abweichungen = referenzen.map((r) => ({
    quelle: r.quelle,
    diff: Math.abs(r.wert - ghasiWert),
  }));
  const amtlicheAbweichung = amtlich.some((r) => Math.abs(r.wert - ghasiWert) > toleranz);
  const abweichendeQuellen = abweichungen.filter((r) => r.diff > toleranz).map((r) => r.quelle);
  const maximaleAbweichung = Math.max(...abweichungen.map((r) => r.diff));

  if (amtlicheAbweichung) {
    return { status: "abweichung", maximaleAbweichung, abweichendeQuellen };
  }
  const hatHerstellerOderBlackbox = referenzen.some((r) => r.stufe !== "A_AMTLICH");
  return {
    status: hatHerstellerOderBlackbox ? "bestaetigt" : "amtlich_bestaetigt",
    maximaleAbweichung,
    abweichendeQuellen,
  };
}

export function rechenStatusZusammenfassung() {
  return RECHEN_AGENTEN.reduce(
    (acc, a) => {
      acc[a.status] += 1;
      return acc;
    },
    { gruen: 0, gelb: 0, gesperrt: 0 } as Record<RechenStatus, number>,
  );
}
