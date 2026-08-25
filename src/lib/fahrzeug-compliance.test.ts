import { describe, expect, it } from "bun:test";

import type { Auftrag } from "@/lib/auftraege";
import { zuweisungsWarnungenFuer } from "@/lib/assignment-conflicts";
import { dispatchAusAuftraege, erkenneKonflikte } from "@/lib/dispatch";
import type { Fahrer } from "@/lib/fahrer";
import {
  bewerteFahrzeug,
  fahrzeugWarnungen,
  INITIAL_FAHRZEUGE,
  type Fahrzeug,
} from "@/lib/fahrzeuge";

const inTagen = (tage: number) =>
  new Date(Date.now() + tage * 86_400_000).toISOString().slice(0, 10);

const basisFahrzeug = (patch: Partial<Fahrzeug> = {}): Fahrzeug => ({
  ...INITIAL_FAHRZEUGE[3]!,
  id: "kfz-test",
  nummer: "KFZ-TEST",
  kennzeichen: "TEST-1",
  status: "frei",
  tankstand: 90,
  reifenstatus: "gut",
  tuevBis: inTagen(400),
  versicherungBis: inTagen(400),
  naechsteWartung: inTagen(400),
  leasingEnde: "",
  kilometerstand: 10_000,
  oelwechselBei: 60_000,
  ...patch,
});

const basisAuftrag = (patch: Partial<Auftrag> = {}): Auftrag =>
  ({
    id: "a-1",
    nummer: "AUF-001",
    patient: "Test Patient",
    patientId: "p-1",
    status: "geplant",
    prioritaet: "normal",
    transportart: "Sitzendtransport",
    termin: `${inTagen(1)}T10:00:00.000Z`,
    abholort: "A",
    zielort: "B",
    fahrer: null,
    fahrzeug: "TEST-1",
    ...patch,
  }) as unknown as Auftrag;

describe("fahrzeugWarnungen / bewerteFahrzeug – fail-closed bei fehlenden Fristen", () => {
  it("meldet keine fehlenden Fristen bei gültigen Zukunftsdaten", () => {
    const warn = fahrzeugWarnungen(basisFahrzeug());
    expect(warn.fehlendeFristen).toBe(false);
    expect(warn.hatWarnung).toBe(false);
    const score = bewerteFahrzeug(basisFahrzeug());
    expect(score?.gruende.some((g) => g.includes("fehlt"))).toBe(false);
  });

  it("(a) Fahrzeug ohne TÜV-Datum: kritischer Hinweis + Score-Abzug", () => {
    const ohneTuev = basisFahrzeug({ tuevBis: "" });
    const warn = fahrzeugWarnungen(ohneTuev);
    expect(warn.tuevFehlt).toBe(true);
    expect(warn.fehlendeFristen).toBe(true);
    expect(warn.tuev).toBe(true);

    const gut = bewerteFahrzeug(basisFahrzeug())!;
    const schlecht = bewerteFahrzeug(ohneTuev)!;
    expect(schlecht.score).toBeLessThan(gut.score);
    expect(schlecht.gruende).toContain("TÜV-Datum fehlt – Prüfung erforderlich");
    expect(schlecht.gruende).not.toContain("Keine offenen Wartungen");
    expect(gut.gruende).not.toContain("TÜV-Datum fehlt – Prüfung erforderlich");
  });
});

describe("erkenneKonflikte – blockierende Compliance-Konflikte", () => {
  const fahrer: Fahrer[] = [];

  it("(b) seit 30 Tagen abgelaufener TÜV blockiert die Zuweisung", () => {
    const fahrzeug = basisFahrzeug({ tuevBis: inTagen(-30) });
    const auftraege = [basisAuftrag()];
    const konflikte = erkenneKonflikte(dispatchAusAuftraege(auftraege), fahrer, [fahrzeug]);
    const tuev = konflikte.filter((k) => k.id.startsWith("tuev-ab-"));
    expect(tuev).toHaveLength(1);
    expect(tuev[0]!.schwere).toBe("kritisch");

    // sichtbar bei der Zuweisung selbst
    const warnungen = zuweisungsWarnungenFuer("a-1", auftraege, fahrer, [fahrzeug]);
    expect(warnungen.some((t) => t.includes("TÜV"))).toBe(true);
  });

  it("(c) abgelaufene Versicherung löst jetzt einen blockierenden Konflikt aus", () => {
    const fahrzeug = basisFahrzeug({ versicherungBis: inTagen(-5) });
    const auftraege = [basisAuftrag()];
    const konflikte = erkenneKonflikte(dispatchAusAuftraege(auftraege), fahrer, [fahrzeug]);
    const vers = konflikte.filter((k) => k.id.startsWith("vers-ab-"));
    expect(vers).toHaveLength(1);
    expect(vers[0]!.schwere).toBe("kritisch");

    const warnungen = zuweisungsWarnungenFuer("a-1", auftraege, fahrer, [fahrzeug]);
    expect(warnungen.some((t) => t.includes("Versicherung"))).toBe(true);
  });

  it("fehlendes Versicherungs-/TÜV-Datum blockiert ebenfalls", () => {
    const fahrzeug = basisFahrzeug({ versicherungBis: "", tuevBis: "" });
    const konflikte = erkenneKonflikte(dispatchAusAuftraege([basisAuftrag()]), fahrer, [fahrzeug]);
    expect(konflikte.some((k) => k.id.startsWith("tuev-fehlt-") && k.schwere === "kritisch")).toBe(
      true,
    );
    expect(konflikte.some((k) => k.id.startsWith("vers-fehlt-") && k.schwere === "kritisch")).toBe(
      true,
    );
  });
});
