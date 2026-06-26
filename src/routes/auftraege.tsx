import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ClipboardList, Plus, Search, SlidersHorizontal } from "lucide-react";

import {
  type Auftrag,
  type AuftragStatus,
  INITIAL_AUFTRAEGE,
  PRIORITAET_META,
  STATUS_META,
  STATUS_PIPELINE,
  formatTermin,
  nextAuftragId,
} from "@/lib/auftraege";
import {
  AuftragForm,
  type AuftragFormValues,
} from "@/components/auftraege/auftrag-form";
import { AuftragDetail } from "@/components/auftraege/auftrag-detail";
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
  const [auftraege, setAuftraege] = useState<Auftrag[]>(INITIAL_AUFTRAEGE);
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
    setAuftraege((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a)),
    );
    toast.success(`Status geändert: ${STATUS_META[status].label}`);
    if (ziel) {
      logActivity({
        bereich: "Aufträge",
        entitaet: `${ziel.nummer} · ${ziel.patient}`,
        aktion: "Status geändert",
        beschreibung: `Status auf „${STATUS_META[status].label}" gesetzt.`,
      });
    }
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
    if (editTarget) {
      setAuftraege((prev) =>
        prev.map((a) => (a.id === editTarget.id ? { ...a, ...values } : a)),
      );
      toast.success("Auftrag aktualisiert");
      logActivity({
        bereich: "Aufträge",
        entitaet: `${editTarget.nummer} · ${values.patient}`,
        aktion: "Auftrag bearbeitet",
        beschreibung: `Auftrag ${editTarget.nummer} wurde aktualisiert.`,
      });
    } else {
      const id = nextAuftragId();
      const nummer = `A-${2045 + auftraege.length}`;
      setAuftraege((prev) => [
        { id, nummer, status: "neu", ...values },
        ...prev,
      ]);
      toast.success(`Auftrag ${nummer} erstellt`);
      logActivity({
        bereich: "Aufträge",
        entitaet: `${nummer} · ${values.patient}`,
        aktion: "Auftrag erstellt",
        beschreibung: `Neuer Transport für ${values.patient} angelegt.`,
      });
    }
    setFormOpen(false);
    setEditTarget(null);
  }

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
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Neuer Auftrag
        </Button>
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
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <ClipboardList className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold">Keine Aufträge gefunden</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Passen Sie Filter oder Suche an, oder erstellen Sie einen neuen Auftrag.
              </p>
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
                          </div>
                        </div>
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
            submitLabel={editTarget ? "Speichern" : "Auftrag erstellen"}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
