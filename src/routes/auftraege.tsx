import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ClipboardList,
  Database,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import {
  type Auftrag,
  type AuftragStatus,
  PRIORITAET_META,
  STATUS_META,
  STATUS_PIPELINE,
  formatTermin,
} from "@/lib/auftraege";
import {
  useOrders,
  useCreateOrder,
  useUpdateOrder,
  useSeedOrders,
} from "@/lib/orders-store";
import type { OrderWrite } from "@/lib/orders-shared";
import {
  AuftragForm,
  type AuftragFormValues,
} from "@/components/auftraege/auftrag-form";
import { AuftragDetail } from "@/components/auftraege/auftrag-detail";
import {
  MedizinBadges,
  fahrzeugMismatch,
} from "@/components/auftraege/medizin-details";
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
import { useAuth } from "@/hooks/use-auth";
import { darfAuftragVerwalten, darfAuftragStatusAendern } from "@/lib/roles";

export const Route = createFileRoute("/auftraege")({
  head: () => ({
    meta: [
      { title: "Aufträge – GHASI AI" },
      {
        name: "description",
        content:
          "Krankentransporte erfassen, im Status-Workflow disponieren, filtern, im Detail prüfen und bearbeiten.",
      },
    ],
  }),
  component: AuftraegePage,
});

type StatusFilter = AuftragStatus | "alle";

function AuftraegePage() {
  const { data: auftraege = [], isLoading, isError, error, refetch, isFetching } =
    useOrders();
  const createMut = useCreateOrder();
  const updateMut = useUpdateOrder();
  const seedMut = useSeedOrders();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  const [prioFilter, setPrioFilter] = useState<string>("alle");

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Auftrag | null>(null);

  const counts = useMemo(() => {
    const base: Record<StatusFilter, number> = {
      alle: auftraege.length,
      neu: 0,
      disponiert: 0,
      unterwegs: 0,
      abgeschlossen: 0,
      storniert: 0,
    };
    for (const a of auftraege) base[a.status] += 1;
    return base;
  }, [auftraege]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auftraege.filter((a) => {
      if (statusFilter !== "alle" && a.status !== statusFilter) return false;
      if (prioFilter !== "alle" && a.prioritaet !== prioFilter) return false;
      if (!q) return true;
      return (
        a.patient.toLowerCase().includes(q) ||
        a.nummer.toLowerCase().includes(q) ||
        a.abholort.toLowerCase().includes(q) ||
        a.zielort.toLowerCase().includes(q) ||
        (a.fahrer ?? "").toLowerCase().includes(q)
      );
    });
  }, [auftraege, search, statusFilter, prioFilter]);

  const detailAuftrag = auftraege.find((a) => a.id === detailId) ?? null;

  function openDetail(a: Auftrag) {
    setDetailId(a.id);
    setDetailOpen(true);
  }

  function handleStatusChange(id: string, status: AuftragStatus) {
    const ziel = auftraege.find((a) => a.id === id);
    updateMut.mutate(
      { id, values: { status } },
      {
        onSuccess: () => {
          toast.success(`Status geändert: ${STATUS_META[status].label}`);
          if (ziel) {
            logActivity({
              bereich: "Aufträge",
              entitaet: `${ziel.nummer} · ${ziel.patient}`,
              aktion: "Status geändert",
              beschreibung: `Status auf „${STATUS_META[status].label}" gesetzt.`,
            });
          }
        },
        onError: (e) => toast.error(`Speichern fehlgeschlagen: ${(e as Error).message}`),
      },
    );
  }

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(a: Auftrag) {
    setEditTarget(a);
    setDetailOpen(false);
    setFormOpen(true);
  }

  function handleSubmit(values: AuftragFormValues) {
    const payload = values as unknown as OrderWrite;
    if (editTarget) {
      updateMut.mutate(
        { id: editTarget.id, values: payload },
        {
          onSuccess: () => {
            toast.success("Auftrag aktualisiert");
            logActivity({
              bereich: "Aufträge",
              entitaet: `${editTarget.nummer} · ${values.patient}`,
              aktion: "Auftrag bearbeitet",
              beschreibung: `Auftrag ${editTarget.nummer} wurde aktualisiert.`,
            });
            setFormOpen(false);
            setEditTarget(null);
          },
          onError: (e) =>
            toast.error(`Speichern fehlgeschlagen: ${(e as Error).message}`),
        },
      );
    } else {
      createMut.mutate(payload, {
        onSuccess: (created) => {
          toast.success(`Auftrag ${created.nummer} erstellt`);
          logActivity({
            bereich: "Aufträge",
            entitaet: `${created.nummer} · ${values.patient}`,
            aktion: "Auftrag erstellt",
            beschreibung: `Neuer Transport für ${values.patient} angelegt.`,
          });
          setFormOpen(false);
          setEditTarget(null);
        },
        onError: (e) =>
          toast.error(`Anlegen fehlgeschlagen: ${(e as Error).message}`),
      });
    }
  }

  function handleSeed() {
    seedMut.mutate(undefined, {
      onSuccess: (res) =>
        res.seeded > 0
          ? toast.success(`${res.seeded} Aufträge geladen`)
          : toast.info("Es sind bereits Aufträge vorhanden"),
      onError: (e) => toast.error(`Laden fehlgeschlagen: ${(e as Error).message}`),
    });
  }

  const saving = createMut.isPending || updateMut.isPending;

  const filterChips: { value: StatusFilter; label: string }[] = [
    { value: "alle", label: "Alle" },
    ...STATUS_PIPELINE.map((s) => ({ value: s, label: STATUS_META[s].label })),
    { value: "storniert", label: STATUS_META.storniert.label },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Aufträge</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Krankentransporte erfassen, disponieren und im Status-Workflow verfolgen.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            title="Aktualisieren"
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Neuer Auftrag
          </Button>
        </div>
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
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  active ? "bg-white/20" : "bg-muted",
                )}
              >
                {counts[chip.value]}
              </span>
            </button>
          );
        })}
      </section>

      {/* Search + priority filter */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Patient, Nummer, Adresse, Fahrer…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={prioFilter} onValueChange={setPrioFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Priorität" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle Prioritäten</SelectItem>
              {Object.entries(PRIORITAET_META).map(([key, meta]) => (
                <SelectItem key={key} value={key}>
                  {meta.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* List */}
      <Card className="border-border/70 shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Aufträge werden geladen …</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold">Aufträge konnten nicht geladen werden</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {(error as Error)?.message ?? "Unbekannter Fehler."}
              </p>
              <Button variant="outline" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Erneut versuchen
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <ClipboardList className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold">Keine Aufträge gefunden</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {auftraege.length === 0
                  ? "Noch keine Aufträge erfasst. Legen Sie einen neuen Auftrag an oder laden Sie die Beispieldaten."
                  : "Passen Sie Filter oder Suche an, oder erstellen Sie einen neuen Auftrag."}
              </p>
              {auftraege.length === 0 && (
                <Button
                  variant="outline"
                  onClick={handleSeed}
                  disabled={seedMut.isPending}
                  className="mt-2 gap-2"
                >
                  {seedMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  Beispieldaten laden
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Auftrag</TableHead>
                  <TableHead className="hidden md:table-cell">Strecke</TableHead>
                  <TableHead className="hidden lg:table-cell">Termin</TableHead>
                  <TableHead className="hidden sm:table-cell">Priorität</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const status = STATUS_META[a.status];
                  const prio = PRIORITAET_META[a.prioritaet];
                  return (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(a)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", status.dot)} />
                          <div className="min-w-0">
                            <p className="font-medium leading-tight">{a.patient}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.nummer} · {a.transportart}
                            </p>
                            <MedizinBadges auftrag={a} className="mt-1.5" />
                          </div>
                        </div>
                        {fahrzeugMismatch(a) && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-warning">
                            <AlertTriangle className="h-3 w-3" /> Fahrzeugtyp prüfen
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-[260px] md:table-cell">
                        <p className="truncate text-sm">{a.abholort}</p>
                        <p className="truncate text-xs text-muted-foreground">→ {a.zielort}</p>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                        {formatTermin(a.termin)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className={prio.badge}>
                          {prio.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1", status.badge)}>
                          <status.icon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail */}
      <AuftragDetail
        auftrag={detailAuftrag}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChange={handleStatusChange}
        onEdit={openEdit}
      />

      {/* Create / Edit form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editTarget ? "Auftrag bearbeiten" : "Neuer Auftrag"}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? `Änderungen an ${editTarget.nummer} speichern.`
                : "Erfassen Sie einen neuen Krankentransport."}
            </DialogDescription>
          </DialogHeader>
          <AuftragForm
            initial={editTarget ?? undefined}
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
            submitLabel={
              saving ? "Speichern …" : editTarget ? "Speichern" : "Auftrag erstellen"
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
