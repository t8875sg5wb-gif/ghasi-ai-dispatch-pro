import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Sparkles,
  Star,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Fuel,
  Euro,
} from "lucide-react";

import {
  type Fahrzeug,
  type FahrzeugStatus,
  FAHRZEUG_STATI,
  FAHRZEUG_STATUS_META,
  empfehleFahrzeug,
  fahrzeugWarnungen,
  formatEUR,
  formatKm,
} from "@/lib/fahrzeuge";
import {
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useSeedVehicles,
} from "@/lib/vehicles-store";
import { FahrzeugForm, type FahrzeugFormValues } from "@/components/fahrzeuge/fahrzeug-form";
import { FahrzeugDetail } from "@/components/fahrzeuge/fahrzeug-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fahrzeuge")({
  head: () => ({
    meta: [
      { title: "Fahrzeuge – GHASI AI" },
      {
        name: "description",
        content:
          "Fahrzeugverwaltung mit Status, Live-GPS, Kosten, Wartungswarnungen und KI-Fahrzeugvorschlag für neue Aufträge.",
      },
    ],
  }),
  component: FahrzeugePage,
});

type StatusFilter = FahrzeugStatus | "alle";

function FahrzeugePage() {
  const { data: fahrzeuge = [] } = useVehicles();
  const createMut = useCreateVehicle();
  const updateMut = useUpdateVehicle();
  const seedMut = useSeedVehicles();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Fahrzeug | null>(null);

  const empfehlungen = useMemo(() => empfehleFahrzeug(fahrzeuge, undefined, 3), [fahrzeuge]);

  const stats = useMemo(() => {
    const frei = fahrzeuge.filter((f) => f.status === "frei").length;
    const unterwegs = fahrzeuge.filter((f) => f.status === "unterwegs").length;
    const warnungen = fahrzeuge.filter((f) => fahrzeugWarnungen(f).hatWarnung).length;
    return { gesamt: fahrzeuge.length, frei, unterwegs, warnungen };
  }, [fahrzeuge]);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      alle: fahrzeuge.length,
      frei: 0,
      unterwegs: 0,
      werkstatt: 0,
      nicht_verfuegbar: 0,
    };
    for (const f of fahrzeuge) base[f.status] += 1;
    return base;
  }, [fahrzeuge]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fahrzeuge.filter((f) => {
      if (statusFilter !== "alle" && f.status !== statusFilter) return false;
      if (!q) return true;
      return (
        f.kennzeichen.toLowerCase().includes(q) ||
        f.nummer.toLowerCase().includes(q) ||
        f.marke.toLowerCase().includes(q) ||
        f.modell.toLowerCase().includes(q) ||
        f.typ.toLowerCase().includes(q) ||
        (f.fahrer ?? "").toLowerCase().includes(q)
      );
    });
  }, [fahrzeuge, search, statusFilter]);

  const detailFahrzeug = fahrzeuge.find((f) => f.id === detailId) ?? null;

  function openDetail(f: Fahrzeug) {
    setDetailId(f.id);
    setDetailOpen(true);
  }

  function handleStatusChange(id: string, status: FahrzeugStatus) {
    updateMut.mutate(
      { id, values: { status } },
      {
        onSuccess: () =>
          toast.success(`Status geändert: ${FAHRZEUG_STATUS_META[status].label}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
      },
    );
  }

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(f: Fahrzeug) {
    setEditTarget(f);
    setDetailOpen(false);
    setFormOpen(true);
  }

  function handleSubmit(values: FahrzeugFormValues) {
    if (editTarget) {
      updateMut.mutate(
        { id: editTarget.id, values },
        {
          onSuccess: () => {
            toast.success("Fahrzeug aktualisiert");
            setFormOpen(false);
            setEditTarget(null);
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
        },
      );
    } else {
      createMut.mutate(values, {
        onSuccess: (row) => {
          toast.success(`Fahrzeug ${row.nummer} angelegt`);
          setFormOpen(false);
          setEditTarget(null);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler"),
      });
    }
  }


  const filterChips: { value: StatusFilter; label: string }[] = [
    { value: "alle", label: "Alle" },
    ...FAHRZEUG_STATI.map((s) => ({ value: s, label: FAHRZEUG_STATUS_META[s].label })),
  ];

  const summaryCards = [
    {
      label: "Fahrzeuge gesamt",
      value: String(stats.gesamt),
      icon: Truck,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "Frei",
      value: String(stats.frei),
      icon: CheckCircle2,
      tone: "bg-success/15 text-success",
    },
    {
      label: "Unterwegs",
      value: String(stats.unterwegs),
      icon: Truck,
      tone: "bg-info/15 text-info",
    },
    {
      label: "Wartungswarnungen",
      value: String(stats.warnungen),
      icon: AlertTriangle,
      tone: "bg-warning/20 text-warning",
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Fahrzeuge</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Flotte, Kosten, Wartung und Verfügbarkeit – mit KI-Fahrzeugvorschlag.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Neues Fahrzeug
        </Button>
      </section>

      {/* Summary stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((s) => (
          <Card key={s.label} className="border-border/70 p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                  s.tone,
                )}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold tabular-nums leading-none">{s.value}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </section>

      {/* GHASI AI recommendation */}
      <section>
        <Card className="overflow-hidden border-primary/20 shadow-card">
          <div className="flex items-center gap-2 border-b border-border/60 bg-gradient-primary px-4 py-3 text-primary-foreground">
            <Sparkles className="h-4 w-4" />
            <p className="text-sm font-semibold">GHASI AI – Fahrzeugvorschlag für neue Aufträge</p>
            <span className="relative ml-auto flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          </div>
          <CardContent className="p-4">
            {empfehlungen.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Aktuell ist kein Fahrzeug einsatzbereit. Bitte Verfügbarkeiten prüfen.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {empfehlungen.map((e, i) => {
                  const sm = FAHRZEUG_STATUS_META[e.fahrzeug.status];
                  return (
                    <button
                      key={e.fahrzeug.id}
                      type="button"
                      onClick={() => openDetail(e.fahrzeug)}
                      className={cn(
                        "group flex flex-col gap-2 rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-card",
                        i === 0 ? "border-primary/40 bg-primary/5" : "border-border/70 bg-card",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {i === 0 && (
                          <Badge className="gap-1 bg-primary text-primary-foreground">
                            <Star className="h-3 w-3 fill-current" />
                            Top-Empfehlung
                          </Badge>
                        )}
                        <span className="ml-auto text-xs font-semibold text-muted-foreground tabular-nums">
                          Score {e.score}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{e.fahrzeug.kennzeichen}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {e.fahrzeug.typ} · {e.fahrzeug.marke} {e.fahrzeug.modell}
                        </p>
                        <Badge variant="outline" className={cn("mt-1 gap-1", sm.badge)}>
                          <sm.icon className="h-3 w-3" />
                          {sm.label}
                        </Badge>
                      </div>
                      <ul className="space-y-0.5">
                        {e.gruende.map((g) => (
                          <li
                            key={g}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground"
                          >
                            <CheckCircle2 className="h-3 w-3 text-success" />
                            {g}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Status filter chips */}
      <section className="flex flex-wrap gap-2">
        {filterChips.map((chip) => {
          const active = statusFilter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => setStatusFilter(chip.value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              {chip.label}
              <span
                className={cn("rounded-full px-1.5 text-xs", active ? "bg-white/20" : "bg-muted")}
              >
                {counts[chip.value]}
              </span>
            </button>
          );
        })}
      </section>

      {/* Search */}
      <section className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche nach Kennzeichen, Typ, Marke, Fahrer…"
          className="pl-9"
        />
      </section>

      {/* Vehicle grid */}
      {filtered.length === 0 ? (
        <Card className="border-border/70">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Truck className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold">Keine Fahrzeuge gefunden</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Passen Sie Filter oder Suche an, oder legen Sie ein neues Fahrzeug an.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => {
            const sm = FAHRZEUG_STATUS_META[f.status];
            const warn = fahrzeugWarnungen(f);
            return (
              <Card
                key={f.id}
                onClick={() => openDetail(f)}
                className="group cursor-pointer border-border/70 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-xs font-bold text-primary-foreground">
                    {f.typ}
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                        sm.dot,
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold leading-tight">{f.kennzeichen}</p>
                      {warn.hatWarnung && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {f.marke} {f.modell} · {f.fahrer ?? "Kein Fahrer"}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("gap-1", sm.badge)}>
                    <sm.icon className="h-3 w-3" />
                    {sm.label}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Fuel className="h-3 w-3" /> Tank
                    </span>
                    <span
                      className={cn("font-medium tabular-nums", warn.tank && "text-destructive")}
                    >
                      {Math.round(f.tankstand)}% · {f.reichweite} km
                    </span>
                  </div>
                  <Progress value={f.tankstand} />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
                  <div>
                    <p className="text-sm font-bold tabular-nums">{formatKm(f.kilometerstand)}</p>
                    <p className="text-[11px] text-muted-foreground">Laufleistung</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold tabular-nums">{f.kostenProKm.toFixed(2)} €</p>
                    <p className="text-[11px] text-muted-foreground">pro km</p>
                  </div>
                  <div>
                    <p className="flex items-center justify-center gap-0.5 text-sm font-bold tabular-nums">
                      <Euro className="h-3 w-3" />
                      {formatEUR(f.tagesgewinn)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Gewinn</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {/* Detail */}
      <FahrzeugDetail
        fahrzeug={detailFahrzeug}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChange={handleStatusChange}
        onEdit={openEdit}
      />

      {/* Create / Edit form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Fahrzeug bearbeiten" : "Neues Fahrzeug"}</DialogTitle>
            <DialogDescription>
              {editTarget
                ? `Änderungen an ${editTarget.kennzeichen} speichern.`
                : "Legen Sie ein neues Fahrzeug mit allen Stammdaten an."}
            </DialogDescription>
          </DialogHeader>
          <FahrzeugForm
            initial={editTarget ?? undefined}
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
            submitLabel={editTarget ? "Speichern" : "Fahrzeug anlegen"}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
