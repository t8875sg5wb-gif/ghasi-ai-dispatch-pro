import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookText, Plus, Trash2, Gauge, Loader2, Download } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useVehicles } from "@/lib/vehicles-store";
import { useTrips, useCreateTrip, useDeleteTrip } from "@/lib/trips-store";
import { fahrtKm, type FahrtWrite } from "@/lib/trips-shared";
import { toISODate } from "@/lib/shifts-shared";
import { downloadCsv, toCsv } from "@/lib/export-utils";

export const Route = createFileRoute("/fahrtenbuch")({
  head: () => ({
    meta: [
      { title: "Fahrtenbuch – GHASI AI" },
      {
        name: "description",
        content: "Kilometernachweis je Fahrzeug für Steuer- und Prüfzwecke.",
      },
    ],
  }),
  component: FahrtenbuchPage,
});

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function FahrtenbuchPage() {
  const { data: fahrzeuge = [] } = useVehicles();
  const { data: fahrten = [], isLoading } = useTrips();
  const deleteMut = useDeleteTrip();

  const [fahrzeugFilter, setFahrzeugFilter] = useState<string>("alle");
  const [formOpen, setFormOpen] = useState(false);

  const kennzeichenVon = (id: string) =>
    fahrzeuge.find((f) => f.id === id)?.kennzeichen ?? "Unbekannt";

  const gefiltert = useMemo(
    () =>
      fahrzeugFilter === "alle" ? fahrten : fahrten.filter((f) => f.vehicleId === fahrzeugFilter),
    [fahrten, fahrzeugFilter],
  );

  const gesamtKm = useMemo(() => gefiltert.reduce((s, f) => s + fahrtKm(f), 0), [gefiltert]);

  const onDelete = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => toast.success("Fahrt gelöscht"),
      onError: (e) => toast.error("Löschen fehlgeschlagen", { description: String(e) }),
    });
  };

  const exportCsv = () => {
    const rows = gefiltert.map((f) => ({
      Datum: f.datum,
      Fahrzeug: kennzeichenVon(f.vehicleId),
      "KM Start": f.kmStart,
      "KM Ende": f.kmEnde,
      Kilometer: fahrtKm(f),
      Fahrer: f.fahrer,
      Zweck: f.zweck,
      Notiz: f.notiz,
    }));
    downloadCsv("fahrtenbuch.csv", toCsv(rows));
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Fahrtenbuch"
        description="Lückenloser Kilometernachweis je Fahrzeug – als Grundlage für Steuer und Betriebsprüfung."
        icon={BookText}
        badge="Nachweis"
        right={
          <Button className="rounded-full" variant="secondary" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Fahrt erfassen
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Erfasste Fahrten" value={String(gefiltert.length)} icon={BookText} tone="info" />
        <StatCard label="Gesamt-Kilometer" value={`${gesamtKm.toLocaleString("de-DE")} km`} icon={Gauge} tone="accent" />
        <StatCard label="Fahrzeuge" value={String(fahrzeuge.length)} icon={Gauge} tone="primary" />
      </section>

      <Card className="border-border/70 shadow-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Fahrten</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={fahrzeugFilter} onValueChange={setFahrzeugFilter}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Fahrzeuge</SelectItem>
                {fahrzeuge.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.kennzeichen} · {f.modell}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={gefiltert.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Fahrten werden geladen …</p>
          )}
          {!isLoading && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Fahrzeug</TableHead>
                    <TableHead className="text-right">KM Start</TableHead>
                    <TableHead className="text-right">KM Ende</TableHead>
                    <TableHead className="text-right">Strecke</TableHead>
                    <TableHead>Fahrer</TableHead>
                    <TableHead>Zweck</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gefiltert.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{formatDatum(f.datum)}</TableCell>
                      <TableCell className="font-medium">{kennzeichenVon(f.vehicleId)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.kmStart.toLocaleString("de-DE")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {f.kmEnde.toLocaleString("de-DE")}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fahrtKm(f).toLocaleString("de-DE")} km
                      </TableCell>
                      <TableCell className="text-muted-foreground">{f.fahrer || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{f.zweck || "—"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => onDelete(f.id)}
                          aria-label="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {gefiltert.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        Keine Fahrten erfasst.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FahrtDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

function FahrtDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: fahrzeuge = [] } = useVehicles();
  const createMut = useCreateTrip();

  const [vehicleId, setVehicleId] = useState("");
  const [datum, setDatum] = useState(() => toISODate(new Date()));
  const [kmStart, setKmStart] = useState("");
  const [kmEnde, setKmEnde] = useState("");
  const [fahrer, setFahrer] = useState("");
  const [zweck, setZweck] = useState("");
  const [notiz, setNotiz] = useState("");

  const reset = () => {
    setVehicleId("");
    setDatum(toISODate(new Date()));
    setKmStart("");
    setKmEnde("");
    setFahrer("");
    setZweck("");
    setNotiz("");
  };

  const submit = () => {
    if (!vehicleId) {
      toast.error("Bitte ein Fahrzeug wählen");
      return;
    }
    const start = Number(kmStart) || 0;
    const ende = Number(kmEnde) || 0;
    if (ende < start) {
      toast.error("KM Ende darf nicht kleiner als KM Start sein");
      return;
    }
    const values: FahrtWrite = {
      vehicleId,
      datum,
      kmStart: start,
      kmEnde: ende,
      fahrer,
      zweck,
      notiz,
    };
    createMut.mutate(values, {
      onSuccess: () => {
        toast.success("Fahrt erfasst");
        reset();
        onOpenChange(false);
      },
      onError: (e) => toast.error("Speichern fehlgeschlagen", { description: String(e) }),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fahrt erfassen</DialogTitle>
          <DialogDescription>Kilometerstand und Zweck für den Nachweis eintragen.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fahrzeug</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wählen …" />
                </SelectTrigger>
                <SelectContent>
                  {fahrzeuge.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.kennzeichen} · {f.modell}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Datum</Label>
              <Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>KM Start</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={kmStart}
                onChange={(e) => setKmStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>KM Ende</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={kmEnde}
                onChange={(e) => setKmEnde(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fahrer</Label>
              <Input value={fahrer} onChange={(e) => setFahrer(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Zweck</Label>
              <Input value={zweck} onChange={(e) => setZweck(e.target.value)} placeholder="z. B. Dialysefahrt" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notiz</Label>
            <Input value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={createMut.isPending}>
            {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
