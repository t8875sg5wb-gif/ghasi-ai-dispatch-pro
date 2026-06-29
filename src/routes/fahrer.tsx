import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Sparkles,
  Star,
  Users,
  CheckCircle2,
  Truck,
  AlertTriangle,
} from "lucide-react";

import {
  type Fahrer,
  type FahrerStatus,
  FAHRER_STATI,
  FAHRER_STATUS_META,
  INITIAL_FAHRER,
  empfehleFahrer,
  formatEUR,
  initials,
  laeuftAb,
  nextFahrerId,
} from "@/lib/fahrer";
import { FahrerForm, type FahrerFormValues } from "@/components/fahrer/fahrer-form";
import { FahrerDetail } from "@/components/fahrer/fahrer-detail";
import { useDrivers, useCreateDriver, useUpdateDriver } from "@/lib/drivers-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fahrer")({
  head: () => ({
    meta: [
      { title: "Fahrer – GHASI AI" },
      {
        name: "description",
        content:
          "Fahrerverwaltung mit Live-Status, GPS, Nachweisen, Leistung und KI-Fahrervorschlag für neue Aufträge.",
      },
    ],
  }),
  component: FahrerPage,
});

type StatusFilter = FahrerStatus | "alle";

function FahrerPage() {
  const { data: dbFahrer } = useDrivers();
  const createMut = useCreateDriver();
  const updateMut = useUpdateDriver();

  const [fahrer, setFahrer] = useState<Fahrer[]>(INITIAL_FAHRER);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Fahrer | null>(null);

  // Keep the local list in sync with persisted drivers (live updates).
  useEffect(() => {
    if (dbFahrer && dbFahrer.length > 0) setFahrer(dbFahrer);
  }, [dbFahrer]);

  // Simulated realtime: drivers "unterwegs" accumulate km / revenue locally.
  useEffect(() => {
    const interval = setInterval(() => {
      setFahrer((prev) =>
        prev.map((f) => {
          if (f.status !== "unterwegs") return f;
          const km = Math.round(Math.random() * 3);
          const umsatz = km * 4;
          return {
            ...f,
            kmHeute: f.kmHeute + km,
            umsatzHeute: f.umsatzHeute + umsatz,
            gewinnHeute: f.gewinnHeute + Math.round(umsatz * 0.4),
          };
        }),
      );
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const empfehlungen = useMemo(() => empfehleFahrer(fahrer, 3), [fahrer]);

  const stats = useMemo(() => {
    const verfuegbar = fahrer.filter((f) => f.status === "verfuegbar").length;
    const unterwegs = fahrer.filter((f) => f.status === "unterwegs").length;
    const warnungen = fahrer.filter(
      (f) =>
        laeuftAb(f.fuehrerschein.gueltigBis) ||
        laeuftAb(f.pSchein.gueltigBis) ||
        laeuftAb(f.ersteHilfe.gueltigBis),
    ).length;
    return { gesamt: fahrer.length, verfuegbar, unterwegs, warnungen };
  }, [fahrer]);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      alle: fahrer.length,
      verfuegbar: 0,
      unterwegs: 0,
      pause: 0,
      urlaub: 0,
      krank: 0,
      feierabend: 0,
    };
    for (const f of fahrer) base[f.status] += 1;
    return base;
  }, [fahrer]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fahrer.filter((f) => {
      if (statusFilter !== "alle" && f.status !== statusFilter) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.nummer.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        (f.fahrzeug ?? "").toLowerCase().includes(q)
      );
    });
  }, [fahrer, search, statusFilter]);

  const detailFahrer = fahrer.find((f) => f.id === detailId) ?? null;

  function openDetail(f: Fahrer) {
    setDetailId(f.id);
    setDetailOpen(true);
  }

  const isPersisted = (id: string) => !!dbFahrer?.some((f) => f.id === id);

  function handleStatusChange(id: string, status: FahrerStatus) {
    setFahrer((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    if (isPersisted(id)) updateMut.mutate({ id, values: { status } });
    toast.success(`Status geändert: ${FAHRER_STATUS_META[status].label}`);
  }

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(f: Fahrer) {
    setEditTarget(f);
    setDetailOpen(false);
    setFormOpen(true);
  }

  function handleSubmit(values: FahrerFormValues) {
    if (editTarget) {
      setFahrer((prev) => prev.map((f) => (f.id === editTarget.id ? { ...f, ...values } : f)));
      if (isPersisted(editTarget.id)) {
        updateMut.mutate({ id: editTarget.id, values });
      }
      toast.success("Fahrer aktualisiert");
    } else {
      createMut.mutate(values, {
        onError: () => toast.error("Fahrer konnte nicht gespeichert werden"),
      });
      const id = nextFahrerId();
      const nummer = `F-${String(fahrer.length + 1).padStart(3, "0")}`;
      setFahrer((prev) => [{ id, nummer, ...values }, ...prev]);
      toast.success(`Fahrer ${nummer} angelegt`);
    }
    setFormOpen(false);
    setEditTarget(null);
  }

  const filterChips: { value: StatusFilter; label: string }[] = [
    { value: "alle", label: "Alle" },
    ...FAHRER_STATI.map((s) => ({ value: s, label: FAHRER_STATUS_META[s].label })),
  ];

  const summaryCards = [
    {
      label: "Fahrer gesamt",
      value: String(stats.gesamt),
      icon: Users,
      tone: "bg-primary/10 text-primary",
    },
    {
      label: "Verfügbar",
      value: String(stats.verfuegbar),
      icon: CheckCircle2,
      tone: "bg-success/15 text-success",
    },
    {
      label: "Unterwegs",
      value: String(stats.unterwegs),
      icon: Truck,
      tone: "bg-warning/20 text-warning",
    },
    {
      label: "Fristen-Warnungen",
      value: String(stats.warnungen),
      icon: AlertTriangle,
      tone: "bg-destructive/15 text-destructive",
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Fahrer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Personal, Nachweise, Live-Status und Leistung – mit KI-Fahrervorschlag.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Neuer Fahrer
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
            <p className="text-sm font-semibold">GHASI AI – Fahrervorschlag für neue Aufträge</p>
            <span className="relative ml-auto flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          </div>
          <CardContent className="p-4">
            {empfehlungen.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Aktuell ist kein Fahrer einsetzbar. Bitte Verfügbarkeiten prüfen.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                {empfehlungen.map((e, i) => {
                  const sm = FAHRER_STATUS_META[e.fahrer.status];
                  return (
                    <button
                      key={e.fahrer.id}
                      type="button"
                      onClick={() => openDetail(e.fahrer)}
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
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9">
                          {e.fahrer.foto && <AvatarImage src={e.fahrer.foto} alt={e.fahrer.name} />}
                          <AvatarFallback className="bg-gradient-primary text-xs font-semibold text-primary-foreground">
                            {initials(e.fahrer.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{e.fahrer.name}</p>
                          <Badge variant="outline" className={cn("mt-0.5 gap-1", sm.badge)}>
                            <sm.icon className="h-3 w-3" />
                            {sm.label}
                          </Badge>
                        </div>
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
          placeholder="Suche nach Name, Fahrer-ID, E-Mail, Fahrzeug…"
          className="pl-9"
        />
      </section>

      {/* Driver grid */}
      {filtered.length === 0 ? (
        <Card className="border-border/70">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <p className="text-base font-semibold">Keine Fahrer gefunden</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Passen Sie Filter oder Suche an, oder legen Sie einen neuen Fahrer an.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => {
            const sm = FAHRER_STATUS_META[f.status];
            const hatWarnung =
              laeuftAb(f.fuehrerschein.gueltigBis) ||
              laeuftAb(f.pSchein.gueltigBis) ||
              laeuftAb(f.ersteHilfe.gueltigBis);
            return (
              <Card
                key={f.id}
                onClick={() => openDetail(f)}
                className="group cursor-pointer border-border/70 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      {f.foto && <AvatarImage src={f.foto} alt={f.name} />}
                      <AvatarFallback className="bg-gradient-primary text-sm font-semibold text-primary-foreground">
                        {initials(f.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card",
                        sm.dot,
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold leading-tight">{f.name}</p>
                      {hatWarnung && (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {f.nummer} · {f.fahrzeug ?? "Kein Fahrzeug"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="gap-1 border-warning/30 bg-warning/10 text-warning"
                  >
                    <Star className="h-3 w-3 fill-current" />
                    {f.bewertung.toFixed(1)}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="outline" className={cn("gap-1", sm.badge)}>
                    <sm.icon className="h-3 w-3" />
                    {sm.label}
                  </Badge>
                  <p className="text-xs text-muted-foreground">{f.puenktlichkeit}% pünktlich</p>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
                  <div>
                    <p className="text-sm font-bold tabular-nums">{f.kmHeute}</p>
                    <p className="text-[11px] text-muted-foreground">km heute</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold tabular-nums">{formatEUR(f.umsatzHeute)}</p>
                    <p className="text-[11px] text-muted-foreground">Umsatz</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold tabular-nums">{formatEUR(f.gewinnHeute)}</p>
                    <p className="text-[11px] text-muted-foreground">Gewinn</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {/* Detail */}
      <FahrerDetail
        fahrer={detailFahrer}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChange={handleStatusChange}
        onEdit={openEdit}
      />

      {/* Create / Edit form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Fahrer bearbeiten" : "Neuer Fahrer"}</DialogTitle>
            <DialogDescription>
              {editTarget
                ? `Änderungen an ${editTarget.name} speichern.`
                : "Legen Sie einen neuen Fahrer mit allen Stammdaten an."}
            </DialogDescription>
          </DialogHeader>
          <FahrerForm
            initial={editTarget ?? undefined}
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
            submitLabel={editTarget ? "Speichern" : "Fahrer anlegen"}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
