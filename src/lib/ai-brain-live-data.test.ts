import { computeInsights, computeKpis, computePrognosen } from "@/lib/ai-brain";
import { profitProFahrer, profitProFahrzeug } from "@/lib/ceo-intelligence";
import type { Auftrag } from "@/lib/auftraege";
import { INITIAL_FAHRER, type Fahrer } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";

const fahrerBackup = [...INITIAL_FAHRER];
const fahrzeugeBackup = [...INITIAL_FAHRZEUGE];

function replace<T>(target: T[], values: T[]) {
  target.splice(0, target.length, ...values);
}

function phantomDriver(): Fahrer {
  return {
    id: "phantom-driver",
    nummer: "F-PHANTOM",
    name: "Phantom Fahrer",
    foto: null,
    telefon: "000",
    email: "phantom@example.invalid",
    adresse: "Test",
    fuehrerschein: { gueltigBis: "2030-01-01" },
    pSchein: { gueltigBis: "2030-01-01" },
    ersteHilfe: { gueltigBis: "2030-01-01" },
    vertragsart: "Vollzeit",
    arbeitszeiten: "Test",
    urlaubstage: 0,
    krankheitstage: 0,
    status: "verfuegbar",
    standort: "Test",
    gps: { lat: 0, lng: 0 },
    fahrzeug: null,
    schicht: "Test",
    bewertung: 5,
    puenktlichkeit: 100,
    beschwerden: 0,
    lob: 0,
    ueberstunden: 99,
    kmHeute: 999,
    umsatzHeute: 9999,
    gewinnHeute: 9999,
  };
}

beforeEach(() => {
  replace(INITIAL_FAHRER, [phantomDriver()]);
  const basis = fahrzeugeBackup[0]!;
  replace(INITIAL_FAHRZEUGE, [
    {
      ...basis,
      id: "phantom-vehicle",
      kennzeichen: "PHANTOM",
      verbrauch: 99,
      reparaturen: [{ datum: "2026-09-01", beschreibung: "phantom", kosten: 9999 }],
    },
  ]);
});

afterEach(() => {
  replace(INITIAL_FAHRER, fahrerBackup);
  replace(INITIAL_FAHRZEUGE, fahrzeugeBackup);
});

describe("Analyse-Hub nutzt explizite Live-Daten", () => {
  test("Prognosen ignorieren Phantom-Fahrer und Phantom-Fahrzeug", () => {
    const liveVehicle = {
      ...fahrzeugeBackup[0]!,
      id: "live",
      kennzeichen: "MI-LIVE",
      verbrauch: 5,
    };
    const kpis = computeKpis({
      fahrer: [],
      fahrzeuge: [liveVehicle],
      auftraege: [],
      rechnungen: [],
    });
    const p = computePrognosen(kpis, { fahrer: [], fahrzeuge: [liveVehicle] });

    expect(p.fahrerbedarf.every((x) => x.ist === 0)).toBe(true);
    expect(p.kraftstoff[0]?.prognose).toBe(8);
    expect(p.kraftstoff[0]?.prognose).not.toBeGreaterThan(100);
  });

  test("Insights bleiben leer, wenn explizite Live-Daten leer sind", () => {
    const insights = computeInsights({
      fahrer: [],
      fahrzeuge: [],
      auftraege: [],
      rechnungen: [],
      patienten: [],
    });
    expect(insights).toEqual([]);
  });

  test("Fahrer-Performance ignoriert Legacy-Umsatzfelder und nutzt Aufträge", () => {
    const fahrer = phantomDriver();
    const auftrag: Auftrag = {
      id: "a-live",
      nummer: "A-LIVE",
      patient: "Test Patient",
      transportart: "Sitzendtransport",
      prioritaet: "normal",
      status: "abgeschlossen",
      abholort: "Minden",
      zielort: "Bad Oeynhausen",
      termin: "2026-09-16T10:00:00+02:00",
      fahrer: fahrer.name,
      fahrerId: fahrer.id,
      fahrzeug: null,
      kostentraeger: "Testkasse",
      notiz: "",
    };

    const [wert] = profitProFahrer([fahrer], [auftrag], [], new Date("2026-09-16T12:00:00+02:00"));
    expect(wert?.umsatz).toBeGreaterThan(0);
    expect(wert?.umsatz).not.toBe(9999);
    expect(wert?.gewinn).not.toBe(9999);
    expect(wert?.km).not.toBe(999);
  });

  test("Fahrzeug-Performance ignoriert Legacy-Monatswerte und nutzt Aufträge", () => {
    const fahrzeug = {
      ...fahrzeugeBackup[0]!,
      id: "live-vehicle",
      kennzeichen: "MI-LIVE",
      monatsumsatz: 9999,
      monatsgewinn: 9999,
    };
    const auftrag: Auftrag = {
      id: "a-fahrzeug-live",
      nummer: "A-FZG-LIVE",
      patient: "Test Patient",
      transportart: "Rollstuhl",
      prioritaet: "normal",
      status: "abgeschlossen",
      abholort: "Minden",
      zielort: "Porta Westfalica",
      termin: "2026-09-16T11:00:00+02:00",
      fahrer: null,
      fahrzeug: fahrzeug.kennzeichen,
      fahrzeugId: fahrzeug.id,
      kostentraeger: "Testkasse",
      notiz: "",
    };

    const [wert] = profitProFahrzeug(
      [fahrzeug],
      [auftrag],
      [],
      new Date("2026-09-16T12:00:00+02:00"),
    );
    expect(wert?.umsatz).toBeGreaterThan(0);
    expect(wert?.umsatz).not.toBe(9999);
    expect(wert?.gewinn).not.toBe(9999);
  });
});
