import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CalendarPlus,
  Database,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Repeat,
  Search,
  SkipForward,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  type Dauerauftrag,
  type DauerauftragStatus,
  type Rhythmus,
  type SerienKategorie,
  DAUERAUFTRAEGE,
  KATEGORIEN,
  KATEGORIE_META,
  RHYTHMEN,
  RHYTHMUS_LABEL,
  STATUS_META,
  WOCHENTAGE,
  abgeleiteterStatus,
  formatDatumDe,
  generiereTransporte,
  heuteISO,
  isoPlusTage,
  naechsteKennung,
  naechsteTermine,
  nextDauerId,
  offeneTermineImZeitraum,
} from "@/lib/dauerauftraege";
import {
  MOBILITAET_META,
  MOBILITAET_OPTIONEN,
  type Mobilitaet,
  FAHRER_OPTIONEN,
  FAHRZEUG_OPTIONEN,
} from "@/lib/auftraege";
import { KRANKENKASSEN, KUNDEN } from "@/lib/stammdaten";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/protokoll";
import {
  useRecurring,
  useCreateRecurring,
  useUpdateRecurring,
  useSeedRecurring,
  useGenerateRecurring,
} from "@/lib/recurring-store";
import { dauerauftragToWrite } from "@/lib/recurring-shared";
import { useAuth } from "@/hooks/use-auth";
import { darfAuftragVerwalten } from "@/lib/roles";

export const Route = createFileRoute("/dauerauftraege")({
  head: () => ({
    meta: [
      { title: "Daueraufträge – GHASI AI" },
      {
        name: "description",
        content:
          "Wiederkehrende Krankentransporte als Serie verwalten: Dialyse-, Pflegeheim- und Klinikfahrten automatisch als reale Aufträge erzeugen, pausieren und steuern.",
      },
    ],
  }),
  component: DauerauftraegePage,
});

type StatusFilter = DauerauftragStatus | "alle";

const leereVorlage = (): Dauerauftrag => ({
  id: "",
  kennung: naechsteKennung(DAUERAUFTRAEGE),
  patient: "",
  abholort: "",
  zielort: "",
  terminzeit: "08:00",
  rueckfahrt: false,
  rueckfahrtzeit: "12:00",
  mobilitaet: "gehfaehig",
  begleitperson: false,
  verordnungErforderlich: true,
  kostentraeger: KUNDEN[0]?.name ?? "",
  krankenkasse: KRANKENKASSEN[0]?.name ?? "",
  bevorzugtesFahrzeug: null,
  bevorzugterFahrer: null,
  notiz: "",
  medizinischeNotiz: "",
  kategorie: "dialyse",
  rhythmus: "woechentlich",
  wochentage: [1, 3, 5],
  startDatum: heuteISO(),
  endDatum: null,
  pausiert: false,
  pauseVon: null,
  pauseBis: null,
  feiertageUeberspringen: true,
  uebersprungeneTermine: [],
  generierteTermine: [],
  erstellt: new Date().toISOString().slice(0, 16),
});

function DauerauftraegePage() {
  const { role } = useAuth();
  const canManage = darfAuftragVerwalten(role);

  const { data: daten = [], isLoading, isError, error, refetch } = useRecurring();
  const createMut = useCreateRecurring();
  const updateMut = useUpdateRecurring();
  const seedMut = useSeedRecurring();
  const generateMut = useGenerateRecurring();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  const [kategorieFilter, setKategorieFilter] = useState<SerienKategorie | "alle">("alle");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Dauerauftrag | null>(null);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = { alle: daten.length, aktiv: 0, pausiert: 0, beendet: 0 };
    for (const d of daten) base[abgeleiteterStatus(d)] += 1;
    return base;
  }, [daten]);

  const gefiltert = useMemo(() => {
    const q = search.trim().toLowerCase();
    return daten.filter((d) => {
      if (statusFilter !== "alle" && abgeleiteterStatus(d) !== statusFilter) return false;
      if (kategorieFilter !== "alle" && d.kategorie !== kategorieFilter) return false;
      if (q) {
        const heu = [d.kennung, d.patient, d.abholort, d.zielort, d.kostentraeger, d.krankenkasse]
          .join(" ")
          .toLowerCase();
        if (!heu.includes(q)) return false;
      }
      return true;
    });
  }, [daten, search, statusFilter, kategorieFilter]);

  const detail = detailId ? daten.find((d) => d.id === detailId) ?? null : null;

  /* --------------------------- Aktionen --------------------------- */

  const handleSeed = () => {
    seedMut.mutate(undefined, {
      onSuccess: (res) =>
        res.seeded > 0
          ? toast.success(`${res.seeded} Daueraufträge geladen`)
          : toast.info("Es sind bereits Daueraufträge vorhanden"),
      onError: (e) => toast.error(`Laden fehlgeschlagen: ${(e as Error).message}`),
    });
  };

  const generieren = (d: Dauerauftrag, tage: number) => {
    const von = heuteISO();
    const bis = isoPlusTage(von, tage);
    generateMut.mutate(
      { id: d.id, vonISO: von, bisISO: bis },
      {
        onSuccess: (res) => {
          if (res.created === 0) {
            toast.info("Keine neuen Transporte", {
              description: `Für ${d.kennung} sind im Zeitraum keine offenen Termine vorhanden.`,
            });
            return;
          }
          toast.success(`${res.created} Transporte erzeugt`, {
            description: `${d.kennung} · ${d.patient} → Aufträge & Dispatch-Center`,
          });
          logActivity({
            bereich: "Daueraufträge",
            aktion: "transporte_generiert",
            beschreibung: `${res.created} Transporte aus Dauerauftrag ${d.kennung} (${d.patient}) für die nächsten ${tage} Tage erzeugt.`,
            entitaet: d.kennung,
          });
        },
        onError: (e) => toast.error(`Erzeugen fehlgeschlagen: ${(e as Error).message}`),
      },
    );
  };

  const pauseUmschalten = (d: Dauerauftrag) => {
    const pausiert = !d.pausiert;
    updateMut.mutate(
      { id: d.id, values: { pausiert } },
      {
        onSuccess: () => {
          toast.success(pausiert ? "Serie pausiert" : "Serie aktiviert");
          logActivity({
            bereich: "Daueraufträge",
            aktion: pausiert ? "pausiert" : "aktiviert",
            beschreibung: `Dauerauftrag ${d.kennung} (${d.patient}) ${pausiert ? "pausiert" : "wieder aktiviert"}.`,
            entitaet: d.kennung,
          });
        },
        onError: (e) => toast.error(`Aktion fehlgeschlagen: ${(e as Error).message}`),
      },
    );
  };

  const beenden = (d: Dauerauftrag) => {
    updateMut.mutate(
      { id: d.id, values: { endDatum: heuteISO() } },
      {
        onSuccess: () => {
          toast.success("Serie beendet");
          logActivity({
            bereich: "Daueraufträge",
            aktion: "beendet",
            beschreibung: `Dauerauftrag ${d.kennung} (${d.patient}) zum ${formatDatumDe(heuteISO())} beendet.`,
            entitaet: d.kennung,
          });
        },
        onError: (e) => toast.error(`Aktion fehlgeschlagen: ${(e as Error).message}`),
      },
    );
  };

  const terminUeberspringen = (d: Dauerauftrag, iso: string) => {
    updateMut.mutate(
      { id: d.id, values: { uebersprungeneTermine: [...d.uebersprungeneTermine, iso] } },
      {
        onSuccess: () => {
          toast.success("Termin übersprungen", { description: formatDatumDe(iso) });
          logActivity({
            bereich: "Daueraufträge",
            aktion: "termin_uebersprungen",
            beschreibung: `Termin ${formatDatumDe(iso)} der Serie ${d.kennung} (${d.patient}) übersprungen (Absage/Skip).`,
            entitaet: d.kennung,
          });
        },
        onError: (e) => toast.error(`Aktion fehlgeschlagen: ${(e as Error).message}`),
      },
    );
  };

  const speichern = (werte: Dauerauftrag) => {
    if (editTarget) {
      updateMut.mutate(
        { id: editTarget.id, values: dauerauftragToWrite(werte) },
        {
          onSuccess: () => {
            toast.success("Dauerauftrag aktualisiert", { description: werte.kennung });
            logActivity({
              bereich: "Daueraufträge",
              aktion: "bearbeitet",
              beschreibung: `Dauerauftrag ${werte.kennung} (${werte.patient}) bearbeitet.`,
              entitaet: werte.kennung,
            });
            setFormOpen(false);
            setEditTarget(null);
          },
          onError: (e) => toast.error(`Speichern fehlgeschlagen: ${(e as Error).message}`),
        },
      );
    } else {
      createMut.mutate(werte, {
        onSuccess: (neu) => {
          toast.success("Dauerauftrag angelegt", { description: neu.kennung });
          logActivity({
            bereich: "Daueraufträge",
            aktion: "angelegt",
            beschreibung: `Neuer Dauerauftrag ${neu.kennung} (${neu.patient}, ${RHYTHMUS_LABEL[neu.rhythmus]}) angelegt.`,
            entitaet: neu.kennung,
          });
          setFormOpen(false);
          setEditTarget(null);
        },
        onError: (e) => toast.error(`Anlegen fehlgeschlagen: ${(e as Error).message}`),
      });
    }
  };

  const saving = createMut.isPending || updateMut.isPending;

  /* ----------------------------- View ----------------------------- */

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Repeat className="size-6 text-primary" /> Daueraufträge
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Wiederkehrende Transporte als Serie – erzeugt automatisch reale Aufträge für Dispatch,
            Fahrer-App, GPS &amp; Abrechnung.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {daten.length === 0 && !isLoading && (
              <Button variant="outline" onClick={handleSeed} disabled={seedMut.isPending}>
                {seedMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Database className="size-4" />
                )}
                Beispieldaten laden
              </Button>
            )}
            <Button
              onClick={() => {
                setEditTarget(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" /> Neuer Dauerauftrag
            </Button>
          </div>
        )}
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { key: "alle", label: "Serien gesamt" },
          { key: "aktiv", label: "Aktiv" },
          { key: "pausiert", label: "Pausiert" },
          { key: "beendet", label: "Beendet" },
        ] as { key: StatusFilter; label: string }[]).map((k) => (
          <Card
            key={k.key}
            className={cn(
              "cursor-pointer transition-colors",
              statusFilter === k.key && "border-primary ring-1 ring-primary/30",
            )}
            onClick={() => setStatusFilter(k.key)}
          >
            <CardContent className="p-4">
              <div className="text-2xl font-semibold tabular-nums">{counts[k.key]}</div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filterleiste */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Patient, Route, Kunde, Kennung…"
            className="pl-9"
          />
        </div>
        <Select value={kategorieFilter} onValueChange={(v) => setKategorieFilter(v as SerienKategorie | "alle")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Kategorien</SelectItem>
            {KATEGORIEN.map((k) => (
              <SelectItem key={k} value={k}>
                {KATEGORIE_META[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabelle */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serie</TableHead>
                <TableHead>Patient &amp; Route</TableHead>
                <TableHead>Rhythmus</TableHead>
                <TableHead>Nächster Termin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" />
                  </TableCell>
                </TableRow>
              )}
              {isError && !isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-destructive">
                    Fehler beim Laden: {(error as Error)?.message}{" "}
                    <Button size="sm" variant="outline" className="ml-2" onClick={() => refetch()}>
                      Erneut versuchen
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && gefiltert.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {daten.length === 0
                      ? "Noch keine Daueraufträge angelegt."
                      : "Keine Daueraufträge gefunden."}
                  </TableCell>
                </TableRow>
              )}
              {gefiltert.map((d) => {
                const st = abgeleiteterStatus(d);
                const StatusIcon = STATUS_META[st].icon;
                const KatIcon = KATEGORIE_META[d.kategorie].icon;
                const naechste = naechsteTermine(d, 1)[0];
                return (
                  <TableRow
                    key={d.id}
                    className="cursor-pointer"
                    onClick={() => setDetailId(d.id)}
                  >
                    <TableCell>
                      <div className="font-medium">{d.kennung}</div>
                      <Badge variant="outline" className={cn("mt-1 gap-1", KATEGORIE_META[d.kategorie].badge)}>
                        <KatIcon className="size-3" /> {KATEGORIE_META[d.kategorie].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{d.patient}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.abholort} → {d.zielort}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{RHYTHMUS_LABEL[d.rhythmus]}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.rhythmus === "woechentlich"
                          ? d.wochentage
                              .slice()
                              .sort()
                              .map((w) => WOCHENTAGE.find((x) => x.wert === w)?.kurz)
                              .join(", ")
                          : "jeden Tag"}{" "}
                        · {d.terminzeit}
                        {d.rueckfahrt ? " ⇄" : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {st === "beendet" ? "—" : naechste ? formatDatumDe(naechste) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("gap-1", STATUS_META[st].badge)}>
                        <StatusIcon className="size-3" /> {STATUS_META[st].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        disabled={st !== "aktiv"}
                        onClick={() => generieren(d, 7)}
                      >
                        <CalendarPlus className="size-4" /> 7 Tage
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail-Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          {detail && (
            <DetailAnsicht
              d={detail}
              onEdit={() => {
                setEditTarget(detail);
                setFormOpen(true);
                setDetailId(null);
              }}
              onGenerate={(tage) => generieren(detail, tage)}
              onPause={() => pauseUmschalten(detail)}
              onEnd={() => beenden(detail)}
              onSkip={(iso) => terminUeberspringen(detail, iso)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Formular-Dialog */}
      <Dialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditTarget(null);
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DauerauftragForm
            initial={editTarget ?? leereVorlage()}
            istEdit={!!editTarget}
            onSubmit={speichern}
            onCancel={() => {
              setFormOpen(false);
              setEditTarget(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================== *
 * Detail-Ansicht
 * ================================================================== */

function DetailAnsicht({
  d,
  onEdit,
  onGenerate,
  onPause,
  onEnd,
  onSkip,
}: {
  d: Dauerauftrag;
  onEdit: () => void;
  onGenerate: (tage: number) => void;
  onPause: () => void;
  onEnd: () => void;
  onSkip: (iso: string) => void;
}) {
  const st = abgeleiteterStatus(d);
  const StatusIcon = STATUS_META[st].icon;
  const termine = naechsteTermine(d, 8);
  const offen30 = offeneTermineImZeitraum(d, heuteISO(), isoPlusTage(heuteISO(), 30)).length;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {d.kennung} · {d.patient}
          <Badge variant="outline" className={cn("gap-1", STATUS_META[st].badge)}>
            <StatusIcon className="size-3" /> {STATUS_META[st].label}
          </Badge>
        </DialogTitle>
        <DialogDescription>
          {RHYTHMUS_LABEL[d.rhythmus]} · {KATEGORIE_META[d.kategorie].label} · seit{" "}
          {formatDatumDe(d.startDatum)}
          {d.endDatum ? ` bis ${formatDatumDe(d.endDatum)}` : ""}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Feld label="Abholort" wert={d.abholort} />
          <Feld label="Zielort" wert={d.zielort} />
          <Feld label="Uhrzeit Hinfahrt" wert={d.terminzeit} />
          <Feld label="Rückfahrt" wert={d.rueckfahrt ? `Ja · ${d.rueckfahrtzeit ?? "—"}` : "Nein"} />
          <Feld label="Mobilität" wert={MOBILITAET_META[d.mobilitaet].label} />
          <Feld label="Begleitperson" wert={d.begleitperson ? "Ja" : "Nein"} />
          <Feld label="Verordnung erforderlich" wert={d.verordnungErforderlich ? "Ja" : "Nein"} />
          <Feld label="Feiertage überspringen" wert={d.feiertageUeberspringen ? "Ja" : "Nein"} />
          <Feld label="Abrechnungskunde" wert={d.kostentraeger} />
          <Feld label="Krankenkasse" wert={d.krankenkasse} />
          <Feld label="Bevorzugtes Fahrzeug" wert={d.bevorzugtesFahrzeug ?? "—"} />
          <Feld label="Bevorzugter Fahrer" wert={d.bevorzugterFahrer ?? "—"} />
          {d.pauseVon && d.pauseBis && (
            <Feld label="Pausenzeitraum" wert={`${formatDatumDe(d.pauseVon)} – ${formatDatumDe(d.pauseBis)}`} />
          )}
          <Feld label="Bereits erzeugt" wert={`${d.generierteTermine.length} Termine`} />
        </div>

        {(d.notiz || d.medizinischeNotiz) && (
          <div className="space-y-1 rounded-lg border bg-muted/30 p-3">
            {d.notiz && (
              <p>
                <span className="font-medium">Notiz: </span>
                {d.notiz}
              </p>
            )}
            {d.medizinischeNotiz && (
              <p className="text-warning">
                <span className="font-medium">Medizinisch: </span>
                {d.medizinischeNotiz}
              </p>
            )}
          </div>
        )}

        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-medium">Nächste Termine</span>
            <span className="text-xs text-muted-foreground">{offen30} offen in 30 Tagen</span>
          </div>
          {termine.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine künftigen Termine.</p>
          ) : (
            <ul className="space-y-1">
              {termine.map((iso) => (
                <li key={iso} className="flex items-center justify-between text-sm">
                  <span className={cn("tabular-nums", d.generierteTermine.includes(iso) && "text-success")}>
                    {formatDatumDe(iso)}
                    {d.generierteTermine.includes(iso) && " · erzeugt"}
                  </span>
                  {!d.generierteTermine.includes(iso) && (
                    <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => onSkip(iso)}>
                      <SkipForward className="size-3" /> überspringen
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <DialogFooter className="flex-wrap gap-2">
        <Button variant="outline" onClick={onEdit}>
          Bearbeiten
        </Button>
        <Button variant="outline" className="gap-1" disabled={st !== "aktiv"} onClick={() => onGenerate(1)}>
          <CalendarPlus className="size-4" /> Heute
        </Button>
        <Button className="gap-1" disabled={st !== "aktiv"} onClick={() => onGenerate(30)}>
          <Sparkles className="size-4" /> 30 Tage erzeugen
        </Button>
        {st !== "beendet" && (
          <Button variant="outline" className="gap-1" onClick={onPause}>
            {d.pausiert ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
            {d.pausiert ? "Aktivieren" : "Pausieren"}
          </Button>
        )}
        {st !== "beendet" && (
          <Button variant="ghost" className="gap-1 text-destructive" onClick={onEnd}>
            <XCircle className="size-4" /> Beenden
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function Feld({ label, wert }: { label: string; wert: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{wert}</div>
    </div>
  );
}

/* ================================================================== *
 * Formular
 * ================================================================== */

function DauerauftragForm({
  initial,
  istEdit,
  onSubmit,
  onCancel,
}: {
  initial: Dauerauftrag;
  istEdit: boolean;
  onSubmit: (d: Dauerauftrag) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Dauerauftrag>(initial);
  const set = <K extends keyof Dauerauftrag>(k: K, v: Dauerauftrag[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const toggleTag = (wert: number) => {
    setF((prev) => ({
      ...prev,
      wochentage: prev.wochentage.includes(wert)
        ? prev.wochentage.filter((w) => w !== wert)
        : [...prev.wochentage, wert],
    }));
  };

  const submit = () => {
    if (!f.patient.trim() || !f.abholort.trim() || !f.zielort.trim()) {
      toast.error("Bitte Patient, Abhol- und Zielort angeben.");
      return;
    }
    if (f.rhythmus === "woechentlich" && f.wochentage.length === 0) {
      toast.error("Bitte mindestens einen Wochentag wählen.");
      return;
    }
    onSubmit(f);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{istEdit ? `Dauerauftrag ${f.kennung} bearbeiten` : "Neuer Dauerauftrag"}</DialogTitle>
        <DialogDescription>
          Serie konfigurieren – erzeugte Transporte erscheinen automatisch in Aufträgen, Dispatch &amp;
          Abrechnung.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Patient</Label>
            <Input value={f.patient} onChange={(e) => set("patient", e.target.value)} placeholder="Name des Patienten" />
          </div>
          <div>
            <Label>Abholort</Label>
            <Input value={f.abholort} onChange={(e) => set("abholort", e.target.value)} />
          </div>
          <div>
            <Label>Zielort</Label>
            <Input value={f.zielort} onChange={(e) => set("zielort", e.target.value)} />
          </div>
          <div>
            <Label>Kategorie</Label>
            <Select value={f.kategorie} onValueChange={(v) => set("kategorie", v as SerienKategorie)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KATEGORIEN.map((k) => (
                  <SelectItem key={k} value={k}>{KATEGORIE_META[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mobilität</Label>
            <Select value={f.mobilitaet} onValueChange={(v) => set("mobilitaet", v as Mobilitaet)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOBILITAET_OPTIONEN.map((m) => (
                  <SelectItem key={m} value={m}>{MOBILITAET_META[m].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Wiederholung */}
        <div className="rounded-lg border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label>Rhythmus</Label>
              <Select value={f.rhythmus} onValueChange={(v) => set("rhythmus", v as Rhythmus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RHYTHMEN.map((r) => (
                    <SelectItem key={r} value={r}>{RHYTHMUS_LABEL[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Uhrzeit Hinfahrt</Label>
              <Input type="time" value={f.terminzeit} onChange={(e) => set("terminzeit", e.target.value)} />
            </div>
            <div>
              <Label>Uhrzeit Rückfahrt</Label>
              <Input
                type="time"
                value={f.rueckfahrtzeit ?? ""}
                disabled={!f.rueckfahrt}
                onChange={(e) => set("rueckfahrtzeit", e.target.value)}
              />
            </div>
          </div>
          {f.rhythmus === "woechentlich" && (
            <div className="mt-3">
              <Label>Wochentage</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {WOCHENTAGE.map((w) => (
                  <Button
                    key={w.wert}
                    type="button"
                    size="sm"
                    variant={f.wochentage.includes(w.wert) ? "default" : "outline"}
                    className="h-8 w-11"
                    onClick={() => toggleTag(w.wert)}
                  >
                    {w.kurz}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Startdatum</Label>
              <Input type="date" value={f.startDatum} onChange={(e) => set("startDatum", e.target.value)} />
            </div>
            <div>
              <Label>Enddatum (optional)</Label>
              <Input
                type="date"
                value={f.endDatum ?? ""}
                onChange={(e) => set("endDatum", e.target.value || null)}
              />
            </div>
            <div>
              <Label>Pause von (optional)</Label>
              <Input
                type="date"
                value={f.pauseVon ?? ""}
                onChange={(e) => set("pauseVon", e.target.value || null)}
              />
            </div>
            <div>
              <Label>Pause bis (optional)</Label>
              <Input
                type="date"
                value={f.pauseBis ?? ""}
                onChange={(e) => set("pauseBis", e.target.value || null)}
              />
            </div>
          </div>
        </div>

        {/* Abrechnung & Präferenzen */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Abrechnungskunde</Label>
            <Select value={f.kostentraeger} onValueChange={(v) => set("kostentraeger", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KUNDEN.map((k) => (
                  <SelectItem key={k.id} value={k.name}>{k.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Krankenkasse</Label>
            <Select value={f.krankenkasse} onValueChange={(v) => set("krankenkasse", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KRANKENKASSEN.map((k) => (
                  <SelectItem key={k.id} value={k.name}>{k.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Bevorzugtes Fahrzeug</Label>
            <Select
              value={f.bevorzugtesFahrzeug ?? "none"}
              onValueChange={(v) => set("bevorzugtesFahrzeug", v === "none" ? null : v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Vorgabe</SelectItem>
                {FAHRZEUG_OPTIONEN.map((x) => (
                  <SelectItem key={x} value={x}>{x}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Bevorzugter Fahrer</Label>
            <Select
              value={f.bevorzugterFahrer ?? "none"}
              onValueChange={(v) => set("bevorzugterFahrer", v === "none" ? null : v)}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Vorgabe</SelectItem>
                {FAHRER_OPTIONEN.map((x) => (
                  <SelectItem key={x} value={x}>{x}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Schalter */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SchalterFeld label="Rückfahrt anlegen" checked={f.rueckfahrt} onChange={(v) => set("rueckfahrt", v)} />
          <SchalterFeld label="Begleitperson" checked={f.begleitperson} onChange={(v) => set("begleitperson", v)} />
          <SchalterFeld
            label="Verordnung erforderlich"
            checked={f.verordnungErforderlich}
            onChange={(v) => set("verordnungErforderlich", v)}
          />
          <SchalterFeld
            label="Feiertage überspringen"
            checked={f.feiertageUeberspringen}
            onChange={(v) => set("feiertageUeberspringen", v)}
          />
          <SchalterFeld label="Pausiert" checked={f.pausiert} onChange={(v) => set("pausiert", v)} />
        </div>

        <div>
          <Label>Notiz</Label>
          <Textarea value={f.notiz} onChange={(e) => set("notiz", e.target.value)} rows={2} />
        </div>
        <div>
          <Label>Medizinische Notiz</Label>
          <Textarea
            value={f.medizinischeNotiz}
            onChange={(e) => set("medizinischeNotiz", e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button onClick={submit}>{istEdit ? "Speichern" : "Anlegen"}</Button>
      </DialogFooter>
    </>
  );
}

function SchalterFeld({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
