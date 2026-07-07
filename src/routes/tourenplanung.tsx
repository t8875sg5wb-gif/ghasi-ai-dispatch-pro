import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import {
  Route as RouteIcon,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Truck,
  Users,
  Activity,
  Clock,
  Euro,
  Gauge,
  Siren,
  Wand2,
  GripVertical,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/protokoll";

import { PRIORITAET_META, verordnungFehlt, effektiveVerordnung } from "@/lib/auftraege";
import {
  MedizinBadges,
  MedizinDetails,
  fahrzeugMismatch,
} from "@/components/auftraege/medizin-details";
import { INITIAL_FAHRER, FAHRER_STATUS_META, initials } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE, FAHRZEUG_STATUS_META } from "@/lib/fahrzeuge";
import {
  type DispatchTransport,
  type DispatchSpalte,
  type Konflikt,
  LIVE_STATUS_META,
  LIVE_PIPELINE,
  DISPATCH_SPALTEN,
  dispatchAusAuftraege,
  dispatchPatchToWrite,
  spalteVon,
  naechsterStatus,
  empfehleDisposition,
  erkenneKonflikte,
  berechneKpis,
  executiveHinweise,
  formatEUR,
} from "@/lib/dispatch";
import { LiveBoard } from "@/components/dispatch/live-board";
import { LiveFleetMapCard } from "@/components/gps/live-fleet-map-card";
import { AlarmCenter } from "@/components/dispatch/alarm-center";
import { boardSpaltePatch, boardSpalteLabel, type BoardSpalte } from "@/lib/dispatch-board";
import { geocode } from "@/lib/fleet-live";
import { useOrders, useUpdateOrder } from "@/lib/orders-store";
import { useDrivers } from "@/lib/drivers-store";
import { useVehicles } from "@/lib/vehicles-store";
import { UnassignedAlerts } from "@/components/auftraege/unassigned-alerts";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/tourenplanung")({
  head: () => ({
    meta: [
      { title: "Dispatch-Center – GHASI AI" },
      {
        name: "description",
        content:
          "Intelligente Disposition: Plantafel, Drag & Drop, KI-Fahrer- und Fahrzeugzuteilung, Konflikterkennung und Live-Status für Krankentransporte.",
      },
    ],
  }),
  component: DispatchCenter,
});

const spaltenTon: Record<DispatchSpalte, string> = {
  warten: "border-info/40",
  aktiv: "border-primary/40",
  verspaetet: "border-destructive/40",
  abgeschlossen: "border-success/40",
};

function DispatchCenter() {
  const { data: orders, isLoading, isError } = useOrders();
  const updateMut = useUpdateOrder();

  const [transporte, setTransporte] = useState<DispatchTransport[]>([]);
  const [fahrer] = useState(() => INITIAL_FAHRER);
  const [fahrzeuge] = useState(() => INITIAL_FAHRZEUGE);
  const [mounted, setMounted] = useState(false);
  const [aktiv, setAktiv] = useState<DispatchTransport | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Keep the board in sync with the persisted orders (single source of truth).
  useEffect(() => {
    if (orders) setTransporte(dispatchAusAuftraege(orders));
  }, [orders]);

  const kpis = useMemo(
    () => berechneKpis(transporte, fahrer, fahrzeuge),
    [transporte, fahrer, fahrzeuge],
  );
  const konflikte = useMemo(
    () => (mounted ? erkenneKonflikte(transporte, fahrer, fahrzeuge) : []),
    [transporte, fahrer, fahrzeuge, mounted],
  );
  const hinweise = useMemo(
    () => (mounted ? executiveHinweise(transporte, fahrer, fahrzeuge) : []),
    [transporte, fahrer, fahrzeuge, mounted],
  );

  const konfliktIds = useMemo(
    () => new Set(konflikte.map((k) => k.transportId).filter(Boolean) as string[]),
    [konflikte],
  );

  // Optimistically update the board and persist the change to the database.
  const persist = useCallback(
    (id: string, patch: Partial<DispatchTransport>) => {
      const values = dispatchPatchToWrite(patch);
      if (Object.keys(values).length > 0) updateMut.mutate({ id, values });
    },
    [updateMut],
  );

  const updateTransport = useCallback(
    (id: string, patch: Partial<DispatchTransport>) => {
      setTransporte((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      setAktiv((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
      persist(id, patch);
    },
    [persist],
  );

  const zuweisen = useCallback(
    (id: string, fahrerName: string) => {
      const t = transporte.find((x) => x.id === id);
      if (!t) return;
      const empf = empfehleDisposition(t, fahrer, fahrzeuge);
      const f = fahrer.find((x) => x.name === fahrerName);
      const fahrzeug = f?.fahrzeug ?? empf.fahrzeug?.kennzeichen ?? t.fahrzeug;
      updateTransport(id, {
        fahrer: fahrerName,
        fahrzeug,
        liveStatus: t.liveStatus === "geplant" ? "fahrzeug_zugewiesen" : t.liveStatus,
      });
      toast.success(`${t.nummer} zugewiesen`, {
        description: `${fahrerName}${fahrzeug ? ` · ${fahrzeug}` : ""}`,
      });
      logActivity({
        bereich: "Dispatch",
        entitaet: t.nummer,
        aktion: "zugewiesen",
        beschreibung: `${t.nummer} an ${fahrerName}${fahrzeug ? ` (${fahrzeug})` : ""} disponiert`,
      });
    },
    [transporte, fahrer, fahrzeuge, updateTransport],
  );

  const kiUebernehmen = useCallback(
    (t: DispatchTransport) => {
      const empf = empfehleDisposition(t, fahrer, fahrzeuge);
      if (!empf.fahrer) {
        toast.error("Keine passende Ressource gefunden");
        return;
      }
      updateTransport(t.id, {
        fahrer: empf.fahrer.name,
        fahrzeug: empf.fahrzeug?.kennzeichen ?? t.fahrzeug,
        liveStatus: "fahrzeug_zugewiesen",
      });
      toast.success("KI-Vorschlag übernommen", { description: empf.erklaerung });
      logActivity({
        bereich: "Dispatch",
        entitaet: t.nummer,
        aktion: "ki-disposition",
        beschreibung: empf.erklaerung,
      });
    },
    [fahrer, fahrzeuge, updateTransport],
  );

  const autoDispatch = useCallback(() => {
    const updates: { id: string; patch: Partial<DispatchTransport> }[] = [];
    setTransporte((prev) =>
      prev.map((t) => {
        if (
          t.liveStatus === "abgeschlossen" ||
          t.liveStatus === "storniert" ||
          (t.fahrer && t.fahrzeug)
        )
          return t;
        const empf = empfehleDisposition(t, fahrer, fahrzeuge);
        if (!empf.fahrer) return t;
        const patch: Partial<DispatchTransport> = {
          fahrer: empf.fahrer.name,
          fahrzeug: empf.fahrzeug?.kennzeichen ?? t.fahrzeug,
          liveStatus: t.liveStatus === "geplant" ? "fahrzeug_zugewiesen" : t.liveStatus,
        };
        updates.push({ id: t.id, patch });
        return { ...t, ...patch };
      }),
    );
    for (const u of updates) persist(u.id, u.patch);
    const count = updates.length;
    toast.success("GHASI AI Auto-Dispatch abgeschlossen", {
      description: `${count} Transporte automatisch disponiert.`,
    });
    logActivity({
      bereich: "Dispatch",
      aktion: "auto-dispatch",
      beschreibung: `GHASI AI hat ${count} Transporte automatisch disponiert`,
    });
  }, [fahrer, fahrzeuge, persist]);

  const statusVor = useCallback(
    (t: DispatchTransport) => {
      const next = naechsterStatus(t.liveStatus === "verspaetet" ? "in_fahrt" : t.liveStatus);
      if (!next) return;
      updateTransport(t.id, { liveStatus: next, verspaetungMin: 0 });
      toast.success(`${t.nummer}: ${LIVE_STATUS_META[next].label}`);
    },
    [updateTransport],
  );

  const verschiebe = useCallback(
    (id: string, spalte: BoardSpalte) => {
      const t = transporte.find((x) => x.id === id);
      if (!t) return;
      updateTransport(id, boardSpaltePatch(spalte));
      toast.success(`${t.nummer}: ${boardSpalteLabel(spalte)}`);
      logActivity({
        bereich: "Dispatch",
        entitaet: t.nummer,
        aktion: "board-verschoben",
        beschreibung: `${t.nummer} nach „${boardSpalteLabel(spalte)}" verschoben`,
      });
    },
    [transporte, updateTransport],
  );

  const oeffneNummerId = useCallback(
    (id: string) => {
      const t = transporte.find((x) => x.id === id);
      if (t) setAktiv(t);
    },
    [transporte],
  );

  const offeneSpalten = useMemo(() => {
    const map: Record<DispatchSpalte, DispatchTransport[]> = {
      warten: [],
      aktiv: [],
      verspaetet: [],
      abgeschlossen: [],
    };
    for (const t of transporte) map[spalteVon(t)].push(t);
    return map;
  }, [transporte]);

  const unzugeordnet = useMemo(
    () =>
      transporte.filter(
        (t) =>
          (!t.fahrer || !t.fahrzeug) &&
          t.liveStatus !== "abgeschlossen" &&
          t.liveStatus !== "storniert",
      ),
    [transporte],
  );

  if (isLoading && transporte.length === 0) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Lade Dispatch-Daten …
      </div>
    );
  }

  if (isError && transporte.length === 0) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Dispatch-Daten konnten nicht geladen werden. Bitte melde dich an oder lade die Seite neu.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-primary flex h-12 w-12 items-center justify-center rounded-2xl shadow-glow">
            <RouteIcon className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dispatch-Center</h1>
            <p className="text-sm text-muted-foreground">
              Intelligente Disposition mit KI – Plantafel, Drag &amp; Drop und Live-Status.
            </p>
          </div>
        </div>
        <Button onClick={autoDispatch} className="gap-2">
          <Wand2 className="h-4 w-4" />
          KI Auto-Dispatch
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Aktiv" value={String(kpis.aktiv)} icon={Activity} tone="primary" />
        <Kpi label="Wartend" value={String(kpis.wartend)} icon={Clock} tone="info" />
        <Kpi
          label="Verspätet"
          value={String(kpis.verspaetet)}
          icon={AlertTriangle}
          tone="destructive"
        />
        <Kpi
          label="Abgeschlossen"
          value={String(kpis.abgeschlossen)}
          icon={CheckCircle2}
          tone="success"
        />
        <Kpi label="Umsatz heute" value={formatEUR(kpis.umsatzHeute)} icon={Euro} tone="success" />
        <Kpi label="Effizienz" value={`${kpis.effizienz}%`} icon={Gauge} tone="accent" />
      </div>

      {/* Dringende, nicht zugewiesene Aufträge */}
      <UnassignedAlerts auftraege={orders ?? []} />

      {/* Resource + insight row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Executive AI */}
        <Card className="border-border/70 lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
            <div className="bg-gradient-accent flex h-8 w-8 items-center justify-center rounded-xl">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <CardTitle className="text-base">GHASI AI – Executive Hinweise</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!mounted ? (
              <p className="text-sm text-muted-foreground">Analysiere Betrieb …</p>
            ) : hinweise.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Alles im grünen Bereich – keine offenen Empfehlungen.
              </p>
            ) : (
              hinweise.map((h) => {
                const Icon = h.icon;
                return (
                  <div
                    key={h.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-3 text-sm",
                      h.tone === "destructive" && "border-destructive/30 bg-destructive/5",
                      h.tone === "warning" && "border-warning/30 bg-warning/5",
                      h.tone === "success" && "border-success/30 bg-success/5",
                      h.tone === "info" && "border-info/30 bg-info/5",
                    )}
                  >
                    <Icon
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        h.tone === "destructive" && "text-destructive",
                        h.tone === "warning" && "text-warning",
                        h.tone === "success" && "text-success",
                        h.tone === "info" && "text-info",
                      )}
                    />
                    <span className="leading-snug">{h.text}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Conflicts */}
        <Card className="border-border/70">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <Siren className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">
              Konflikte
              {mounted && konflikte.length > 0 && (
                <Badge className="ml-2 border-destructive/30 bg-destructive/10 text-destructive">
                  {konflikte.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!mounted ? (
              <p className="text-sm text-muted-foreground">Prüfe Konflikte …</p>
            ) : konflikte.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> Keine Konflikte erkannt.
              </div>
            ) : (
              <ScrollArea className="h-[210px] pr-3">
                <div className="space-y-2">
                  {konflikte.map((k) => (
                    <KonfliktZeile
                      key={k.id}
                      konflikt={k}
                      onClick={() => {
                        const t = transporte.find((x) => x.id === k.transportId);
                        if (t) setAktiv(t);
                      }}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="live-board">
        <TabsList>
          <TabsTrigger value="live-board">Live-Board</TabsTrigger>
          <TabsTrigger value="live-karte">Live-Karte</TabsTrigger>
          <TabsTrigger value="alarme">Alarm-Center</TabsTrigger>
          <TabsTrigger value="plantafel">Plantafel</TabsTrigger>
          <TabsTrigger value="disposition">Disposition</TabsTrigger>
          <TabsTrigger value="flotte">Flotte</TabsTrigger>
        </TabsList>

        {/* Live-Karte: Echtzeit-Flottenkarte (Google Maps) */}
        <TabsContent value="live-karte" className="mt-4">
          <LiveFleetMapCard height="h-[60vh] min-h-[420px]" />
        </TabsContent>


        {/* Live-Board: 12-Spalten Enterprise-Dispatch mit Filter & Bulk */}
        <TabsContent value="live-board" className="mt-4">
          <LiveBoard
            transporte={transporte}
            konfliktIds={konfliktIds}
            onOpen={setAktiv}
            onMove={verschiebe}
          />
        </TabsContent>

        {/* Alarm-Center: vereinte Konflikte & Flotten-Alerts */}
        <TabsContent value="alarme" className="mt-4">
          <AlarmCenter konflikte={konflikte} transporte={transporte} onOpen={oeffneNummerId} />
        </TabsContent>

        {/* Plantafel: Kanban by status */}
        <TabsContent value="plantafel" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-4">
            {DISPATCH_SPALTEN.map((s) => (
              <div key={s.key} className="min-w-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold">{s.label}</span>
                  <Badge variant="secondary" className="tabular-nums">
                    {offeneSpalten[s.key].length}
                  </Badge>
                </div>
                <div
                  className={cn(
                    "space-y-2 rounded-2xl border border-dashed p-2",
                    spaltenTon[s.key],
                  )}
                >
                  {offeneSpalten[s.key].length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Keine Transporte
                    </p>
                  )}
                  {offeneSpalten[s.key].map((t) => (
                    <TransportCard
                      key={t.id}
                      t={t}
                      hatKonflikt={konfliktIds.has(t.id)}
                      onClick={() => setAktiv(t)}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Disposition: drag & drop assignment */}
        <TabsContent value="disposition" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Unassigned pool */}
            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-sm font-semibold">Offene Transporte</span>
                <Badge variant="secondary">{unzugeordnet.length}</Badge>
              </div>
              <p className="mb-2 px-1 text-xs text-muted-foreground">
                Karte auf einen Fahrer ziehen, um zuzuweisen.
              </p>
              <div className="space-y-2 rounded-2xl border border-dashed border-border/70 p-2">
                {unzugeordnet.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    Alle Transporte sind disponiert 🎉
                  </p>
                )}
                {unzugeordnet.map((t) => (
                  <TransportCard
                    key={t.id}
                    t={t}
                    hatKonflikt={konfliktIds.has(t.id)}
                    onClick={() => setAktiv(t)}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                  />
                ))}
              </div>
            </div>

            {/* Driver drop lanes */}
            <div className="lg:col-span-3">
              <div className="mb-2 px-1 text-sm font-semibold">Fahrer</div>
              <div className="space-y-2">
                {fahrer.map((f) => {
                  const meta = FAHRER_STATUS_META[f.status];
                  const last = transporte.filter(
                    (t) =>
                      t.fahrer === f.name &&
                      t.liveStatus !== "abgeschlossen" &&
                      t.liveStatus !== "storniert",
                  ).length;
                  return (
                    <div
                      key={f.id}
                      onDragOver={(e) => {
                        if (meta.einsetzbar) e.preventDefault();
                      }}
                      onDrop={() => {
                        if (dragId && meta.einsetzbar) zuweisen(dragId, f.name);
                        setDragId(null);
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border p-3 transition-colors",
                        meta.einsetzbar
                          ? "border-border/70 hover:border-primary/50 hover:bg-primary/5"
                          : "border-border/50 bg-muted/30 opacity-70",
                      )}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {initials(f.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{f.name}</span>
                          <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {meta.label} · {f.fahrzeug ?? "kein Fahrzeug"} · {f.ueberstunden}h ÜS
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {last} Touren
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Flotte: vehicles overview */}
        <TabsContent value="flotte" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fahrzeuge.map((v) => {
              const meta = FAHRZEUG_STATUS_META[v.status];
              return (
                <Card key={v.id} className="border-border/70">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{v.kennzeichen}</span>
                      <Badge className={meta.badge}>{meta.label}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {v.marke} {v.modell} · {v.typ}
                    </p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tank</span>
                        <span className="tabular-nums">{v.tankstand}%</span>
                      </div>
                      <Progress value={v.tankstand} className="h-1.5" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {v.rollstuhlGeeignet && (
                        <Badge variant="secondary" className="text-[10px]">
                          Rollstuhl
                        </Badge>
                      )}
                      {v.liegendGeeignet && (
                        <Badge variant="secondary" className="text-[10px]">
                          Liegend
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        {v.fahrer ?? "frei"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail dialog */}
      <TransportDialog
        t={aktiv}
        fahrer={fahrer}
        fahrzeuge={fahrzeuge}
        onOpenChange={(o) => !o && setAktiv(null)}
        onKi={kiUebernehmen}
        onStatus={statusVor}
        onAssign={zuweisen}
      />
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  tone: "primary" | "info" | "success" | "destructive" | "accent";
}) {
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/15 text-info",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/15 text-destructive",
    accent: "bg-accent/15 text-accent",
  };
  return (
    <Card className="border-border/70 p-3">
      <div className="flex items-center gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">{label}</p>
          <p className="text-base font-bold tabular-nums leading-tight">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function TransportCard({
  t,
  hatKonflikt,
  onClick,
  draggable,
  onDragStart,
}: {
  t: DispatchTransport;
  hatKonflikt: boolean;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
}) {
  const meta =
    LIVE_STATUS_META[
      t.verspaetungMin >= 10 && t.liveStatus !== "abgeschlossen" ? "verspaetet" : t.liveStatus
    ];
  const prio = PRIORITAET_META[t.prioritaet];
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        "group w-full rounded-xl border bg-card p-3 text-left transition-all hover:shadow-card",
        hatKonflikt ? "border-destructive/50" : "border-border/70",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {draggable && <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
          <span className="truncate text-xs font-semibold tabular-nums">{t.nummer}</span>
          {t.istNotfall && <Siren className="h-3.5 w-3.5 shrink-0 text-destructive" />}
          {hatKonflikt && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{t.abholzeit}</span>
      </div>
      <p className="mt-1 truncate text-sm font-medium">{t.patient}</p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        {t.zielort}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <Badge className={cn("text-[10px]", meta.badge)}>{meta.label}</Badge>
        <Badge className={cn("text-[10px]", prio.badge)}>{prio.label}</Badge>
        {t.wiederkehrend && t.serie && (
          <Badge variant="secondary" className="text-[10px]">
            {t.serie}
          </Badge>
        )}
        {t.fahrer && (
          <Badge variant="secondary" className="text-[10px]">
            {t.fahrer}
          </Badge>
        )}
      </div>
      <MedizinBadges auftrag={t} className="mt-1.5" />
      {(verordnungFehlt(effektiveVerordnung(t)) || fahrzeugMismatch(t)) && (
        <div className="mt-1.5 space-y-0.5">
          {verordnungFehlt(effektiveVerordnung(t)) && (
            <p className="flex items-center gap-1 text-[10px] font-medium text-destructive">
              <AlertTriangle className="h-3 w-3" /> Verordnung fehlt
            </p>
          )}
          {fahrzeugMismatch(t) && (
            <p className="flex items-center gap-1 text-[10px] font-medium text-warning">
              <AlertTriangle className="h-3 w-3" /> Fahrzeugtyp prüfen
            </p>
          )}
        </div>
      )}
    </button>
  );
}

function KonfliktZeile({ konflikt, onClick }: { konflikt: Konflikt; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg border p-2 text-left text-xs transition-colors hover:bg-muted/50",
        konflikt.schwere === "kritisch"
          ? "border-destructive/30 bg-destructive/5"
          : "border-warning/30 bg-warning/5",
      )}
    >
      <AlertTriangle
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          konflikt.schwere === "kritisch" ? "text-destructive" : "text-warning",
        )}
      />
      <span className="leading-snug">{konflikt.text}</span>
    </button>
  );
}

function TransportDialog({
  t,
  fahrer,
  fahrzeuge,
  onOpenChange,
  onKi,
  onStatus,
  onAssign,
}: {
  t: DispatchTransport | null;
  fahrer: typeof INITIAL_FAHRER;
  fahrzeuge: typeof INITIAL_FAHRZEUGE;
  onOpenChange: (o: boolean) => void;
  onKi: (t: DispatchTransport) => void;
  onStatus: (t: DispatchTransport) => void;
  onAssign: (id: string, fahrer: string) => void;
}) {
  const empf = useMemo(
    () => (t ? empfehleDisposition(t, fahrer, fahrzeuge) : null),
    [t, fahrer, fahrzeuge],
  );
  if (!t) return null;
  const next = naechsterStatus(t.liveStatus === "verspaetet" ? "in_fahrt" : t.liveStatus);

  return (
    <Dialog open={!!t} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t.nummer}
            {t.istNotfall && <Siren className="h-4 w-4 text-destructive" />}
          </DialogTitle>
          <DialogDescription>
            {t.patient} · {t.transportart}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* route */}
          <div className="rounded-xl border border-border/70 p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" /> {t.abholort}
            </div>
            <div className="my-1 ml-2 h-4 border-l border-dashed border-border" />
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> {t.zielort}
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Abholung {t.abholzeit}</span>
              <span>Ankunft {t.ankunftzeit}</span>
              <span>{t.distanzKm} km</span>
              <span>{formatEUR(t.erloes)}</span>
            </div>
          </div>

          {/* Live-Position & Abrechnung */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border/70 p-2.5">
              <p className="text-xs text-muted-foreground">Aktuelle Position (GPS)</p>
              <p className="mt-0.5 font-medium tabular-nums">
                {(() => {
                  const g = geocode(
                    t.liveStatus === "patient_an_bord" || t.liveStatus === "in_fahrt"
                      ? t.zielort
                      : t.abholort,
                  );
                  return `${g.lat}, ${g.lng}`;
                })()}
              </p>
              <p className="text-xs text-muted-foreground">ETA {t.ankunftzeit}</p>
            </div>
            <div className="rounded-lg border border-border/70 p-2.5">
              <p className="text-xs text-muted-foreground">Abrechnung</p>
              <p className="mt-0.5 font-medium">
                {t.abrechnungBereit
                  ? "Abrechnung bereit"
                  : t.liveStatus === "abgeschlossen"
                    ? "Abgeschlossen"
                    : "In Bearbeitung"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatEUR(t.erloes)} · {t.kostentraeger}
              </p>
            </div>
          </div>

          {/* medizinische Transportdetails */}
          <MedizinDetails auftrag={t} rolle="dispo" />

          {/* status pipeline */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Live-Status</p>
            <div className="flex flex-wrap gap-1">
              {LIVE_PIPELINE.map((s) => {
                const done = LIVE_STATUS_META[s].stufe <= LIVE_STATUS_META[t.liveStatus].stufe;
                return (
                  <span
                    key={s}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px]",
                      done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {LIVE_STATUS_META[s].label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* AI recommendation */}
          {empf && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-accent" />
                KI-Empfehlung
                <Badge variant="secondary" className="ml-auto">
                  Score {empf.gesamtScore}
                </Badge>
              </div>
              <p className="mt-1.5 text-sm">{empf.erklaerung}</p>
              {empf.gruende.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {empf.gruende.map((g) => (
                    <Badge key={g} variant="secondary" className="text-[10px]">
                      {g}
                    </Badge>
                  ))}
                </div>
              )}
              <Button size="sm" className="mt-3 w-full gap-2" onClick={() => onKi(t)}>
                <Wand2 className="h-4 w-4" /> Vorschlag übernehmen
              </Button>
            </div>
          )}

          {/* current assignment */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-border/70 p-2">
              <p className="text-xs text-muted-foreground">Fahrer</p>
              <p className="font-medium">{t.fahrer ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border/70 p-2">
              <p className="text-xs text-muted-foreground">Fahrzeug</p>
              <p className="font-medium">{t.fahrzeug ?? "—"}</p>
            </div>
          </div>

          {/* quick assign */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Schnellzuweisung</p>
            <div className="flex flex-wrap gap-1.5">
              {fahrer
                .filter((f) => FAHRER_STATUS_META[f.status].einsetzbar)
                .map((f) => (
                  <Button
                    key={f.id}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onAssign(t.id, f.name)}
                  >
                    {f.name}
                  </Button>
                ))}
            </div>
          </div>

          {next && (
            <Button className="w-full gap-2" onClick={() => onStatus(t)}>
              Status weiter: {LIVE_STATUS_META[next].label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
