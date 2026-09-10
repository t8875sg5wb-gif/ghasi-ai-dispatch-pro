import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CalendarPlus,
  CheckCircle2,
  Database,
  Loader2,
  PauseCircle,
  PencilLine,
  PlayCircle,
  Plus,
  Repeat,
  Search,
  SkipForward,
  Sparkles,
  TriangleAlert,
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
  heuteISO,
  isoPlusTage,
  naechsteKennung,
  naechsteTermine,
  offeneTermineImZeitraum,
} from "@/lib/dauerauftraege";
import { TerminVorschau } from "@/components/dauerauftraege/termin-vorschau";
import { MOBILITAET_META, MOBILITAET_OPTIONEN, type Mobilitaet } from "@/lib/auftraege";
import { recurringFieldsSchema } from "@/lib/recurring.functions";
import {
  feldFehlerMap,
  pruefeDauerauftragRegeln,
  zuFeldFehlern,
  type FeldFehler,
} from "@/lib/recurring-validation";
import { parseRecurringFehler } from "@/lib/api/dauerauftraege";
import {
  ENTWURF_DEBOUNCE_MS,
  entwurfSchluessel,
  entwurfWeichtAb,
  formatUhrzeit,
  formatZeitmarke,
  geaenderteFelder,
  ladeEntwurf,
  retryVerzoegerung,
  verwerfeEntwurf,
  versucheEntwurfZuSpeichern,
  type GespeicherterEntwurf,
} from "@/lib/dauerauftrag-entwurf";
import { KRANKENKASSEN } from "@/lib/stammdaten";
import { usePatients } from "@/lib/patients-store";
import { useInsurers } from "@/lib/insurers-store";
import {
  useDriverIdOptions,
  useVehicleIdOptions,
  useCustomerOptions,
} from "@/hooks/use-entity-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { AddressFields } from "@/components/forms/address-fields";
import {
  formatAdresseMehrzeilig,
  leereAdresse,
  parseAdresse,
  type AdresseStruktur,
} from "@/lib/address";

export const Route = createFileRoute("/dauerauftraege")({
  head: () => ({
    meta: [
      { title: "Daueraufträge – GHASI AI" },
      {
        name: "description",
        content:
          "Wiederkehrende Krankentransporte als Serie verwalten: Dialyse-, Pflegeheim- und Klinikfahrten automatisch als reale Aufträge erzeugen, pausieren und steuern.",
      },
      { property: "og:title", content: "Daueraufträge – GHASI AI" },
      {
        property: "og:description",
        content:
          "Wiederkehrende Krankentransporte als Serie verwalten: Dialyse-, Pflegeheim- und Klinikfahrten automatisch als reale Aufträge erzeugen, pausieren und steuern.",
      },
    ],
  }),
  component: DauerauftraegePage,
});

/** Sentinel für "nicht verknüpft" in Selects (Radix erlaubt kein leeres Value). */
const KEINE = "__keine__";

type StatusFilter = DauerauftragStatus | "alle";

const leereVorlage = (): Dauerauftrag => ({
  id: "",
  kennung: naechsteKennung(DAUERAUFTRAEGE),
  patient: "",
  patientId: null,
  insurerId: null,
  pickup: leereAdresse(),
  destination: leereAdresse(),
  abholort: "",
  zielort: "",
  terminzeit: "08:00",
  rueckfahrt: false,
  rueckfahrtzeit: "12:00",
  mobilitaet: "gehfaehig",
  begleitperson: false,
  verordnungErforderlich: true,
  kostentraeger: "",
  krankenkasse: KRANKENKASSEN[0]?.name ?? "",
  bevorzugtesFahrzeug: null,
  bevorzugterFahrer: null,
  bevorzugterFahrerId: null,
  bevorzugtesFahrzeugId: null,
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
  const [neueVorlage, setNeueVorlage] = useState<Dauerauftrag>(() => leereVorlage());
  const [serverFeldFehler, setServerFeldFehler] = useState<FeldFehler[]>([]);
  const [serverHinweis, setServerHinweis] = useState<string | null>(null);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      alle: daten.length,
      aktiv: 0,
      pausiert: 0,
      beendet: 0,
    };
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
          .map((x) => x ?? "")
          .join(" ")
          .toLowerCase();
        if (!heu.includes(q)) return false;
      }
      return true;
    });
  }, [daten, search, statusFilter, kategorieFilter]);

  const detail = detailId ? (daten.find((d) => d.id === detailId) ?? null) : null;

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
    setServerFeldFehler([]);
    setServerHinweis(null);
    const zeigeFehler = (praefix: string) => (e: unknown) => {
      const fehler = parseRecurringFehler(e);
      if (fehler.art === "feldfehler") {
        setServerFeldFehler(fehler.fields);
        toast.error(`${praefix}: ${fehler.text}`, {
          description: fehler.fields.map((x) => `${x.label}: ${x.message}`).join(" · "),
        });
        return;
      }
      setServerHinweis(fehler.text);
      toast.error(`${praefix}: ${fehler.text}`);
    };
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
            verwerfeEntwurf(entwurfSchluessel(editTarget.id));
            setFormOpen(false);
            setEditTarget(null);
          },
          onError: zeigeFehler("Speichern fehlgeschlagen"),
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
          verwerfeEntwurf(entwurfSchluessel(null));
          setFormOpen(false);
          setEditTarget(null);
        },
        onError: zeigeFehler("Anlegen fehlgeschlagen"),
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
                setNeueVorlage(leereVorlage());
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
        {(
          [
            { key: "alle", label: "Serien gesamt" },
            { key: "aktiv", label: "Aktiv" },
            { key: "pausiert", label: "Pausiert" },
            { key: "beendet", label: "Beendet" },
          ] as { key: StatusFilter; label: string }[]
        ).map((k) => (
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
        <Select
          value={kategorieFilter}
          onValueChange={(v) => setKategorieFilter(v as SerienKategorie | "alle")}
        >
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
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
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
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
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
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => setDetailId(d.id)}>
                    <TableCell>
                      <div className="font-medium">{d.kennung}</div>
                      <Badge
                        variant="outline"
                        className={cn("mt-1 gap-1", KATEGORIE_META[d.kategorie].badge)}
                      >
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
          setServerFeldFehler([]);
          setServerHinweis(null);
          if (!o) setEditTarget(null);
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DauerauftragForm
            initial={editTarget ?? neueVorlage}
            istEdit={!!editTarget}
            saving={saving}
            serverFehler={serverFeldFehler}
            serverHinweis={serverHinweis}
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
  const fahrerIdOpt = useDriverIdOptions();
  const fahrzeugIdOpt = useVehicleIdOptions();
  const fahrerLabel = (x: Dauerauftrag) =>
    fahrerIdOpt.options.find((o) => o.value === x.bevorzugterFahrerId)?.label ?? null;
  const fahrzeugLabel = (x: Dauerauftrag) =>
    fahrzeugIdOpt.options.find((o) => o.value === x.bevorzugtesFahrzeugId)?.label ?? null;
  const st = abgeleiteterStatus(d);
  const StatusIcon = STATUS_META[st].icon;
  const termine = naechsteTermine(d, 8);
  const offen30 = offeneTermineImZeitraum(d, heuteISO(), isoPlusTage(heuteISO(), 30)).length;
  const pickupZeilen = formatAdresseMehrzeilig(d.pickup ?? parseAdresse(d.abholort));
  const destinationZeilen = formatAdresseMehrzeilig(d.destination ?? parseAdresse(d.zielort));

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
          <Feld label="Pickup" wert={pickupZeilen.length ? pickupZeilen.join(" · ") : "—"} />
          <Feld
            label="Destination"
            wert={destinationZeilen.length ? destinationZeilen.join(" · ") : "—"}
          />
          <Feld label="Uhrzeit Hinfahrt" wert={d.terminzeit} />
          <Feld
            label="Rückfahrt"
            wert={d.rueckfahrt ? `Ja · ${d.rueckfahrtzeit ?? "—"}` : "Nein"}
          />
          <Feld label="Mobilität" wert={MOBILITAET_META[d.mobilitaet].label} />
          <Feld label="Begleitperson" wert={d.begleitperson ? "Ja" : "Nein"} />
          <Feld label="Verordnung erforderlich" wert={d.verordnungErforderlich ? "Ja" : "Nein"} />
          <Feld label="Feiertage überspringen" wert={d.feiertageUeberspringen ? "Ja" : "Nein"} />
          <Feld label="Abrechnungskunde" wert={d.kostentraeger} />
          <Feld label="Krankenkasse" wert={d.krankenkasse} />
          <Feld
            label="Bevorzugtes Fahrzeug"
            wert={fahrzeugLabel(d) ?? d.bevorzugtesFahrzeug ?? "—"}
          />
          <Feld label="Bevorzugter Fahrer" wert={fahrerLabel(d) ?? d.bevorzugterFahrer ?? "—"} />
          {d.pauseVon && d.pauseBis && (
            <Feld
              label="Pausenzeitraum"
              wert={`${formatDatumDe(d.pauseVon)} – ${formatDatumDe(d.pauseBis)}`}
            />
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
                  <span
                    className={cn(
                      "tabular-nums",
                      d.generierteTermine.includes(iso) && "text-success",
                    )}
                  >
                    {formatDatumDe(iso)}
                    {d.generierteTermine.includes(iso) && " · erzeugt"}
                  </span>
                  {!d.generierteTermine.includes(iso) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1"
                      onClick={() => onSkip(iso)}
                    >
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
        <Button
          variant="outline"
          className="gap-1"
          disabled={st !== "aktiv"}
          onClick={() => onGenerate(1)}
        >
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
  saving,
  serverFehler = [],
  serverHinweis = null,
  onSubmit,
  onCancel,
}: {
  initial: Dauerauftrag;
  istEdit: boolean;
  saving?: boolean;
  serverFehler?: FeldFehler[];
  serverHinweis?: string | null;
  onSubmit: (d: Dauerauftrag) => void;
  onCancel: () => void;
}) {
  const normalisiere = (d: Dauerauftrag): Dauerauftrag => ({
    ...d,
    pickup: d.pickup ?? parseAdresse(d.abholort),
    destination: d.destination ?? parseAdresse(d.zielort),
  });
  const [f, setF] = useState<Dauerauftrag>(() => normalisiere(initial));
  const [beruehrt, setBeruehrt] = useState<string[]>([]);
  const [submitVersucht, setSubmitVersucht] = useState(false);

  /* ---------------------- Auto-Save (Entwurf) ---------------------- */
  const entwurfKey = entwurfSchluessel(istEdit ? initial.id : null);
  const basisRef = useRef<Dauerauftrag>(normalisiere(initial));
  // Letzter erfolgreich zwischengespeicherter Stand – Basis für den Dirty-Status.
  const gesichertRef = useRef<Dauerauftrag>(normalisiere(initial));
  const [entwurfGespeichertAm, setEntwurfGespeichertAm] = useState<string | null>(null);
  const [entwurfSoebenGespeichert, setEntwurfSoebenGespeichert] = useState(false);
  const [wiederherstellbar, setWiederherstellbar] = useState<GespeicherterEntwurf | null>(null);
  // Entwurf aus einer früheren Ansicht (z. B. nach einem Reload) – noch nicht übernommen.
  const [entwurfOffen, setEntwurfOffen] = useState(false);
  const [entwurfFehler, setEntwurfFehler] = useState<{
    meldung: string;
    wiederholt: boolean;
    versuche: number;
    zeitpunkt: string;
  } | null>(null);
  const [entwurfRetryZaehler, setEntwurfRetryZaehler] = useState(0);

  const merkeBeruehrt = (...paths: string[]) =>
    setBeruehrt((prev) => {
      const neu = paths.filter((p) => !prev.includes(p));
      return neu.length > 0 ? [...prev, ...neu] : prev;
    });

  /** Vollständige Feldwerte (Adressen normalisiert) – Basis für jede Prüfung. */
  const werteFuerPruefung = (quelle: Dauerauftrag): Dauerauftrag => ({
    ...quelle,
    pickup: quelle.pickup ?? parseAdresse(quelle.abholort),
    destination: quelle.destination ?? parseAdresse(quelle.zielort),
    abholort: "",
    zielort: "",
  });

  /** Gleiche Regeln wie serverseitig – für Live- und Submit-Prüfung. */
  const validiere = (quelle: Dauerauftrag): FeldFehler[] => {
    const write = dauerauftragToWrite(werteFuerPruefung(quelle));
    const parsed = recurringFieldsSchema.safeParse(write);
    return parsed.success ? pruefeDauerauftragRegeln(write, true) : zuFeldFehlern(parsed.error);
  };

  // Live-Validierung: bei jeder Änderung neu berechnet.
  const liveFehler = useMemo(() => validiere(f), [f]);

  // Prüfstatus des gesicherten Entwurfs (nach einem Reload noch nicht übernommen).
  const entwurfFehlerAnzahl = useMemo(
    () => (wiederherstellbar ? validiere(normalisiere(wiederherstellbar.werte)).length : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wiederherstellbar],
  );

  const istBeruehrt = (path: string) =>
    beruehrt.includes(path) || beruehrt.includes(path.split(".")[0] ?? path);

  // Vor dem ersten Absenden nur Fehler zu bereits bearbeiteten Feldern zeigen.
  const sichtbareLiveFehler = submitVersucht
    ? liveFehler
    : liveFehler.filter((x) => istBeruehrt(x.path));
  // Serverfehler zu Feldern, die inzwischen bearbeitet wurden, ausblenden.
  const offeneServerFehler = serverFehler.filter(
    (x) => !istBeruehrt(x.path) && !liveFehler.some((l) => l.path === x.path),
  );
  const fehler: FeldFehler[] = [
    ...sichtbareLiveFehler,
    ...offeneServerFehler.filter((s) => !sichtbareLiveFehler.some((l) => l.path === s.path)),
  ];
  const fehlerMap = useMemo(() => feldFehlerMap(fehler), [fehler]);
  // Dirty-Status: weicht das Formular vom letzten gesicherten Stand ab?
  const ungespeicherteAenderungen = entwurfGespeichertAm
    ? entwurfWeichtAb(f, gesichertRef.current)
    : entwurfWeichtAb(f, basisRef.current);
  const FeldFehlerText = ({ path }: { path: string }) =>
    fehlerMap[path] ? (
      <p id={`fehler-${path}`} className="pt-1 text-xs font-medium text-destructive">
        {fehlerMap[path]}
      </p>
    ) : null;

  /** Scrollt zum fehlerhaften Feld, fokussiert es und hebt es kurz hervor. */
  const springeZuFeld = (path: string) => {
    const wurzel = path.split(".")[0] ?? path;
    const ziel =
      document.getElementById(`feld-${path}`) ??
      document.getElementById(`feld-${wurzel}`) ??
      document.getElementById(`fehler-${path}`);
    if (!ziel) return;
    ziel.scrollIntoView({ behavior: "smooth", block: "center" });
    const fokussierbar = ziel.querySelector<HTMLElement>(
      "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    fokussierbar?.focus({ preventScroll: true });
    ziel.classList.add("ring-2", "ring-destructive", "rounded-lg", "ring-offset-2");
    window.setTimeout(
      () => ziel.classList.remove("ring-2", "ring-destructive", "rounded-lg", "ring-offset-2"),
      1600,
    );
  };

  const fahrerOpt = useDriverIdOptions();
  const fahrzeugOpt = useVehicleIdOptions();
  const kundeOpt = useCustomerOptions();
  const { data: patienten = [] } = usePatients();
  const { data: kassen = [] } = useInsurers();

  useEffect(() => {
    const basis = normalisiere(initial);
    basisRef.current = basis;
    gesichertRef.current = basis;
    setF(basis);
    setBeruehrt([]);
    setSubmitVersucht(false);
    setEntwurfGespeichertAm(null);
    setEntwurfSoebenGespeichert(false);
    setEntwurfFehler(null);
    const gefunden = ladeEntwurf(entwurfSchluessel(istEdit ? initial.id : null));
    const offen = gefunden && entwurfWeichtAb(gefunden.werte, basis) ? gefunden : null;
    setWiederherstellbar(offen);
    // Nach einem Reload den letzten Speicherstand weiterhin anzeigen.
    setEntwurfOffen(offen !== null);
    if (offen) setEntwurfGespeichertAm(offen.gespeichertAm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, istEdit]);

  // Auto-Save: speichert den Entwurf nach einer kurzen Tipp-Pause.
  // Schlägt das Speichern fehl, wird die Meldung angezeigt und der Versuch
  // automatisch mit steigender Wartezeit wiederholt.
  useEffect(() => {
    if (!entwurfWeichtAb(f, basisRef.current)) return;
    let versuch = 0;
    let timer = 0;
    const lauf = () => {
      const ergebnis = versucheEntwurfZuSpeichern(entwurfKey, f);
      if (ergebnis.ok) {
        gesichertRef.current = f;
        setEntwurfGespeichertAm(ergebnis.eintrag.gespeichertAm);
        setEntwurfFehler(null);
        setEntwurfSoebenGespeichert(true);
        setEntwurfOffen(false);
        return;
      }
      const wartezeit = retryVerzoegerung(versuch, ergebnis.grund);
      setEntwurfFehler({
        meldung: ergebnis.meldung,
        wiederholt: wartezeit !== null,
        versuche: versuch + 1,
      });
      if (wartezeit === null) return;
      versuch += 1;
      timer = window.setTimeout(lauf, wartezeit);
    };
    timer = window.setTimeout(lauf, ENTWURF_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [f, entwurfKey, entwurfRetryZaehler]);

  // „Soeben gespeichert“-Hinweis nach jedem erfolgreichen Auto-Save sofort
  // anzeigen und nach 3 Sekunden wieder ausblenden.
  useEffect(() => {
    if (!entwurfSoebenGespeichert) return;
    const timer = window.setTimeout(() => setEntwurfSoebenGespeichert(false), 3000);
    return () => window.clearTimeout(timer);
  }, [entwurfSoebenGespeichert]);

  /** Manueller Neuversuch für den Auto-Save. */
  const entwurfErneutSpeichern = () => {
    const ergebnis = versucheEntwurfZuSpeichern(entwurfKey, f);
    if (ergebnis.ok) {
      gesichertRef.current = f;
      setEntwurfGespeichertAm(ergebnis.eintrag.gespeichertAm);
      setEntwurfFehler(null);
      setEntwurfSoebenGespeichert(true);
      toast.success("Entwurf zwischengespeichert");
      return;
    }
    setEntwurfFehler({ meldung: ergebnis.meldung, wiederholt: false, versuche: 1 });
    setEntwurfRetryZaehler((n) => n + 1);
  };

  /** Entwurf übernehmen – Live-Validierung zeigt danach genau die geänderten Felder. */
  const entwurfUebernehmen = () => {
    if (!wiederherstellbar) return;
    const werte = normalisiere(wiederherstellbar.werte);
    setF(werte);
    merkeBeruehrt(...geaenderteFelder(werte, basisRef.current));
    setWiederherstellbar(null);
    setEntwurfOffen(false);
    gesichertRef.current = werte;
    setEntwurfGespeichertAm(wiederherstellbar.gespeichertAm);
    setEntwurfSoebenGespeichert(true);
    toast.success("Entwurf wiederhergestellt");
  };

  const entwurfLoeschen = () => {
    verwerfeEntwurf(entwurfKey);
    setWiederherstellbar(null);
    setEntwurfOffen(false);
    setEntwurfGespeichertAm(null);
    setEntwurfFehler(null);
    gesichertRef.current = basisRef.current;
    setF(basisRef.current);
    setBeruehrt([]);
    setSubmitVersucht(false);
  };

  const set = <K extends keyof Dauerauftrag>(k: K, v: Dauerauftrag[K]) => {
    merkeBeruehrt(String(k));
    setF((prev) => ({ ...prev, [k]: v }));
  };
  const setAdresse = (key: "pickup" | "destination", value: AdresseStruktur) => {
    merkeBeruehrt(key);
    setF((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "pickup" ? { abholort: "" } : { zielort: "" }),
    }));
  };

  const toggleTag = (wert: number) => {
    merkeBeruehrt("wochentage");
    setF((prev) => ({
      ...prev,
      wochentage: prev.wochentage.includes(wert)
        ? prev.wochentage.filter((w) => w !== wert)
        : [...prev.wochentage, wert],
    }));
  };

  const submit = () => {
    setSubmitVersucht(true);
    const werte = werteFuerPruefung(f);
    const gefunden = validiere(f);
    if (gefunden.length > 0) {
      toast.error("Bitte die markierten Felder korrigieren.", {
        description: gefunden.map((x) => `${x.label}: ${x.message}`).join(" · "),
      });
      window.setTimeout(() => springeZuFeld(gefunden[0].path), 0);
      return;
    }
    onSubmit(werte);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {istEdit ? `Dauerauftrag ${f.kennung} bearbeiten` : "Neuer Dauerauftrag"}
        </DialogTitle>
        <DialogDescription>
          Serie konfigurieren – erzeugte Transporte erscheinen automatisch in Aufträgen, Dispatch
          &amp; Abrechnung.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {wiederherstellbar && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
            <span>
              Es gibt einen nicht gespeicherten Entwurf von{" "}
              <strong>{formatUhrzeit(wiederherstellbar.gespeichertAm)} Uhr</strong>.
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={entwurfLoeschen}>
                Verwerfen
              </Button>
              <Button size="sm" onClick={entwurfUebernehmen}>
                Entwurf übernehmen
              </Button>
            </div>
          </div>
        )}

        {entwurfFehler && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm"
          >
            <span>
              <strong>Zwischenspeichern fehlgeschlagen.</strong> {entwurfFehler.meldung}
              {entwurfFehler.wiederholt
                ? ` Automatischer Neuversuch läuft (Versuch ${entwurfFehler.versuche}).`
                : " Automatische Neuversuche sind ausgeschöpft."}
            </span>
            <Button size="sm" variant="outline" onClick={entwurfErneutSpeichern}>
              Jetzt erneut versuchen
            </Button>
          </div>
        )}

        {serverHinweis && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <strong>Speichern abgelehnt.</strong> {serverHinweis}
          </div>
        )}

        {fehler.length > 0 && (
          <div
            id="fehler-zusammenfassung"
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            <p className="font-medium text-destructive">
              {fehler.length === 1
                ? "1 Feld ist ungültig"
                : `${fehler.length} Felder sind ungültig`}
            </p>
            <ul className="mt-1 space-y-0.5 text-destructive">
              {fehler.map((x) =>
                x.path === "formular" ? (
                  <li key={x.path}>
                    <span className="font-medium">{x.label}</span>: {x.message}
                  </li>
                ) : (
                  <li key={x.path}>
                    <button
                      type="button"
                      onClick={() => springeZuFeld(x.path)}
                      className="text-left underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
                      aria-label={`Zum Feld ${x.label} springen`}
                    >
                      <span className="font-medium">{x.label}</span>{" "}
                      <span className="text-muted-foreground">({x.path})</span>: {x.message}
                    </button>
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2" id="feld-patient">
            <Label>Patient (Stammdaten)</Label>
            <Select
              value={f.patientId ?? KEINE}
              onValueChange={(v) => {
                if (v === KEINE) {
                  setF((prev) => ({ ...prev, patientId: null }));
                  return;
                }
                const p = patienten.find((x) => x.id === v);
                setF((prev) => ({
                  ...prev,
                  patientId: v,
                  patient: p?.name ?? prev.patient,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nicht verknüpft" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEINE}>Nicht verknüpft</SelectItem>
                {patienten.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Noch keine Patienten angelegt.
                  </div>
                ) : (
                  patienten.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Label className="pt-1 block">Patientenname</Label>
            <Input
              value={f.patient}
              onChange={(e) => set("patient", e.target.value)}
              placeholder="Name des Patienten"
              aria-invalid={!!fehlerMap["patient"]}
              aria-describedby={fehlerMap["patient"] ? "fehler-patient" : undefined}
            />
            <FeldFehlerText path="patient" />
            {!f.patientId && (
              <p className="text-xs text-muted-foreground">
                Ohne Verknüpfung wird nur der Freitext gespeichert.
              </p>
            )}
          </div>
          <div className="sm:col-span-2" id="feld-pickup">
            <AddressFields
              idPrefix="dauer-pickup"
              label="Pickup"
              required
              value={f.pickup ?? parseAdresse(f.abholort)}
              onChange={(value) => setAdresse("pickup", value)}
            />
            <FeldFehlerText path="pickup" />
            <FeldFehlerText path="pickup.postalCode" />
          </div>
          <div className="sm:col-span-2" id="feld-destination">
            <AddressFields
              idPrefix="dauer-destination"
              label="Destination"
              required
              value={f.destination ?? parseAdresse(f.zielort)}
              onChange={(value) => setAdresse("destination", value)}
            />
            <FeldFehlerText path="destination" />
            <FeldFehlerText path="destination.postalCode" />
          </div>
          <div id="feld-kategorie">
            <Label>Kategorie</Label>
            <Select
              value={f.kategorie}
              onValueChange={(v) => set("kategorie", v as SerienKategorie)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KATEGORIEN.map((k) => (
                  <SelectItem key={k} value={k}>
                    {KATEGORIE_META[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div id="feld-mobilitaet">
            <Label>Mobilität</Label>
            <Select value={f.mobilitaet} onValueChange={(v) => set("mobilitaet", v as Mobilitaet)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOBILITAET_OPTIONEN.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MOBILITAET_META[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Wiederholung */}
        <div className="rounded-lg border p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div id="feld-rhythmus">
              <Label>Rhythmus</Label>
              <Select value={f.rhythmus} onValueChange={(v) => set("rhythmus", v as Rhythmus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RHYTHMEN.map((r) => (
                    <SelectItem key={r} value={r}>
                      {RHYTHMUS_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div id="feld-terminzeit">
              <Label>Uhrzeit Hinfahrt</Label>
              <Input
                type="time"
                value={f.terminzeit}
                onChange={(e) => set("terminzeit", e.target.value)}
                aria-invalid={!!fehlerMap["terminzeit"]}
              />
              <FeldFehlerText path="terminzeit" />
            </div>
            <div id="feld-rueckfahrtzeit">
              <Label>Uhrzeit Rückfahrt</Label>
              <Input
                type="time"
                value={f.rueckfahrtzeit ?? ""}
                disabled={!f.rueckfahrt}
                onChange={(e) => set("rueckfahrtzeit", e.target.value)}
                aria-invalid={!!fehlerMap["rueckfahrtzeit"]}
              />
              <FeldFehlerText path="rueckfahrtzeit" />
            </div>
          </div>
          {f.rhythmus === "woechentlich" && (
            <div className="mt-3" id="feld-wochentage">
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
              <FeldFehlerText path="wochentage" />
            </div>
          )}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div id="feld-startDatum">
              <Label>Startdatum</Label>
              <Input
                type="date"
                value={f.startDatum}
                onChange={(e) => set("startDatum", e.target.value)}
                aria-invalid={!!fehlerMap["startDatum"]}
              />
              <FeldFehlerText path="startDatum" />
            </div>
            <div id="feld-endDatum">
              <Label>Enddatum (optional)</Label>
              <Input
                type="date"
                value={f.endDatum ?? ""}
                onChange={(e) => set("endDatum", e.target.value || null)}
                aria-invalid={!!fehlerMap["endDatum"]}
              />
              <FeldFehlerText path="endDatum" />
            </div>
            <div id="feld-pauseVon">
              <Label>Pause von (optional)</Label>
              <Input
                type="date"
                value={f.pauseVon ?? ""}
                onChange={(e) => set("pauseVon", e.target.value || null)}
                aria-invalid={!!fehlerMap["pauseVon"]}
              />
              <FeldFehlerText path="pauseVon" />
            </div>
            <div id="feld-pauseBis">
              <Label>Pause bis (optional)</Label>
              <Input
                type="date"
                value={f.pauseBis ?? ""}
                onChange={(e) => set("pauseBis", e.target.value || null)}
                aria-invalid={!!fehlerMap["pauseBis"]}
              />
              <FeldFehlerText path="pauseBis" />
            </div>
          </div>
        </div>

        {/* Abrechnung & Präferenzen */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div id="feld-kostentraeger">
            <Label>Abrechnungskunde</Label>
            <Select value={f.kostentraeger} onValueChange={(v) => set("kostentraeger", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kundeOpt.leer ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    {kundeOpt.hinweis}
                  </div>
                ) : (
                  kundeOpt.options.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div id="feld-krankenkasse">
            <Label>Krankenkasse</Label>
            <Select
              value={f.insurerId ?? KEINE}
              onValueChange={(v) => {
                if (v === KEINE) {
                  setF((prev) => ({ ...prev, insurerId: null }));
                  return;
                }
                const k = kassen.find((x) => x.id === v);
                setF((prev) => ({
                  ...prev,
                  insurerId: v,
                  krankenkasse: k?.name ?? prev.krankenkasse,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nicht verknüpft" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={KEINE}>Nicht verknüpft</SelectItem>
                {kassen.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Noch keine Kostenträger angelegt.
                  </div>
                ) : (
                  kassen.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Label className="pt-1 block">Krankenkasse (Text)</Label>
            <Input
              value={f.krankenkasse}
              onChange={(e) => set("krankenkasse", e.target.value)}
              placeholder="z. B. AOK Nordost"
            />
          </div>
          <div id="feld-bevorzugtesFahrzeugId">
            <Label>Bevorzugtes Fahrzeug</Label>
            {f.bevorzugtesFahrzeug && !f.bevorzugtesFahrzeugId && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Altbestand: „{f.bevorzugtesFahrzeug}" ist nur als Kennzeichen hinterlegt und keinem
                Fahrzeugdatensatz zugeordnet. Bitte erneut auswählen.
              </p>
            )}
            <Select
              value={f.bevorzugtesFahrzeugId ?? "none"}
              onValueChange={(v) => set("bevorzugtesFahrzeugId", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Vorgabe</SelectItem>
                {fahrzeugOpt.options.map((x) => (
                  <SelectItem key={x.value} value={x.value}>
                    {x.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div id="feld-bevorzugterFahrerId">
            <Label>Bevorzugter Fahrer</Label>
            {f.bevorzugterFahrer && !f.bevorzugterFahrerId && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Altbestand: „{f.bevorzugterFahrer}" ist nur als Name hinterlegt und keinem
                Fahrerdatensatz zugeordnet. Bitte erneut auswählen.
              </p>
            )}
            <Select
              value={f.bevorzugterFahrerId ?? "none"}
              onValueChange={(v) => set("bevorzugterFahrerId", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Vorgabe</SelectItem>
                {fahrerOpt.options.map((x) => (
                  <SelectItem key={x.value} value={x.value}>
                    {x.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Schalter */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SchalterFeld
            label="Rückfahrt anlegen"
            checked={f.rueckfahrt}
            onChange={(v) => set("rueckfahrt", v)}
          />
          <SchalterFeld
            label="Begleitperson"
            checked={f.begleitperson}
            onChange={(v) => set("begleitperson", v)}
          />
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
          <SchalterFeld
            label="Pausiert"
            checked={f.pausiert}
            onChange={(v) => set("pausiert", v)}
          />
        </div>

        <TerminVorschau dauerauftrag={f} regelFehler={fehler} onFehlerKlick={springeZuFeld} />

        <div id="feld-notiz">
          <Label>Notiz</Label>
          <Textarea value={f.notiz} onChange={(e) => set("notiz", e.target.value)} rows={2} />
        </div>
        <div id="feld-medizinischeNotiz">
          <Label>Medizinische Notiz</Label>
          <Textarea
            value={f.medizinischeNotiz}
            onChange={(e) => set("medizinischeNotiz", e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <DialogFooter className="items-center gap-2 sm:justify-between">
        <div aria-live="polite" className="flex flex-col gap-1 text-xs">
          {/* Zeile 1: eindeutiger Zustand – gespeichert, offen oder fehlgeschlagen. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex items-center gap-1.5 font-medium ${
                  entwurfFehler
                    ? "text-warning"
                    : entwurfOffen || ungespeicherteAenderungen
                      ? "text-muted-foreground"
                      : "text-success"
                }`}
              >
                {entwurfFehler ? (
                  <>
                    <TriangleAlert className="size-3.5" aria-hidden="true" />
                    {entwurfFehler.wiederholt
                      ? `Nicht gesichert · Neuversuch läuft (Versuch ${entwurfFehler.versuche})`
                      : "Nicht gesichert · bitte manuell erneut versuchen"}
                  </>
                ) : entwurfOffen ? (
                  <>
                    <PencilLine className="size-3.5" aria-hidden="true" />
                    Gesicherter Entwurf vorhanden · noch nicht übernommen
                  </>
                ) : ungespeicherteAenderungen ? (
                  <>
                    <PencilLine className="size-3.5" aria-hidden="true" />
                    Ungespeicherte Änderungen
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    {entwurfGespeichertAm ? "Alle Änderungen gesichert" : "Keine Änderungen"}
                  </>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-xs">
              {entwurfFehler
                ? "Der letzte Auto-Save-Versuch ist fehlgeschlagen. Ihre Änderungen wurden noch nicht gesichert; der Versuch wird automatisch wiederholt oder kann manuell neu gestartet werden."
                : entwurfOffen
                  ? "Ein gesicherter Entwurf aus einer früheren Sitzung liegt vor. Er wurde noch nicht in das aktuelle Formular übernommen."
                  : ungespeicherteAenderungen
                    ? "Sie haben Änderungen vorgenommen, die noch nicht automatisch zwischengespeichert wurden."
                    : "Der aktuelle Stand ist mit dem letzten Auto-Save identisch."}
            </TooltipContent>
          </Tooltip>
          {/* Zeile 2: Zeitmarke des letzten Zwischenspeicherns. */}
          <span className="text-muted-foreground">
            {entwurfGespeichertAm
              ? `Zuletzt gesichert: ${entwurfSoebenGespeichert ? "gerade eben · " : ""}${formatZeitmarke(entwurfGespeichertAm)}`
              : "Zuletzt gesichert: noch nie"}
          </span>

          {/* Zeile 3: eindeutiger Validierungsstatus mit Fehleranzahl. */}
          <span className="flex items-center gap-2 text-xs">
            {(() => {
              const anzahl = entwurfOffen ? entwurfFehlerAnzahl : liveFehler.length;
              const gueltig = anzahl === 0;
              return (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1 px-2 py-0.5 font-medium",
                          gueltig
                            ? "border-success text-success"
                            : "border-destructive text-destructive",
                        )}
                      >
                        {gueltig ? (
                          <>
                            <CheckCircle2 className="size-3" aria-hidden="true" />
                            Gültig
                          </>
                        ) : (
                          <>
                            <TriangleAlert className="size-3" aria-hidden="true" />
                            {anzahl} {anzahl === 1 ? "Feld" : "Felder"} ungültig
                          </>
                        )}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="start" className="max-w-xs">
                      {gueltig
                        ? "Alle Pflichtfelder sind ausgefüllt und alle Plausibilitätsprüfungen bestanden."
                        : entwurfOffen
                          ? `Der wiederhergestellte Entwurf enthält ${anzahl} ungültige ${anzahl === 1 ? "Feld" : "Felder"}. Übernehmen Sie den Entwurf, um die Fehler im Formular zu korrigieren.`
                          : `Mindestens ein Feld verletzt eine Validierungsregel. Klicken Sie auf „Zu den Fehlern“, um zur Übersicht zu springen.`}
                    </TooltipContent>
                  </Tooltip>
                  {!gueltig && !entwurfOffen && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-destructive"
                      onClick={() => {
                        const summary = document.getElementById("fehler-zusammenfassung");
                        if (summary) {
                          summary.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                        const first = fehler[0]?.path;
                        if (first) springeZuFeld(first);
                      }}
                    >
                      Zu den Fehlern
                    </Button>
                  )}
                </>
              );
            })()}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {istEdit ? "Speichern" : "Anlegen"}
          </Button>
        </div>
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
