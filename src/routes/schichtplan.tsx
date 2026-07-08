import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { useDrivers } from "@/lib/drivers-store";
import {
  useShifts,
  useCreateShift,
  useDeleteShift,
} from "@/lib/shifts-store";
import {
  SHIFT_META,
  SHIFT_TYPEN,
  startOfWeek,
  addDays,
  toISODate,
  findShiftConflicts,
  type Shift,
  type ShiftTyp,
} from "@/lib/shifts-shared";

export const Route = createFileRoute("/schichtplan")({
  head: () => ({
    meta: [
      { title: "Schichtplan – GHASI AI" },
      {
        name: "description",
        content:
          "Kalender für Fahrerdienste, Urlaub und Krankheit mit automatischer Doppelbelegungs-Prüfung.",
      },
    ],
  }),
  component: SchichtplanPage,
});

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function SchichtplanPage() {
  const [ankerDatum, setAnkerDatum] = useState(() => startOfWeek(new Date()));
  const [zelle, setZelle] = useState<{ driverId: string; datum: string } | null>(null);

  const { data: fahrer = [] } = useDrivers();
  const { data: shifts = [], isLoading } = useShifts();

  const tage = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(ankerDatum, i)),
    [ankerDatum],
  );
  const tageISO = useMemo(() => tage.map(toISODate), [tage]);

  const wochenShifts = useMemo(
    () => shifts.filter((s) => tageISO.includes(s.datum)),
    [shifts, tageISO],
  );
  const konflikte = useMemo(() => findShiftConflicts(wochenShifts), [wochenShifts]);

  const shiftsFuer = (driverId: string, datum: string) =>
    wochenShifts.filter((s) => s.driverId === driverId && s.datum === datum);

  const heuteISO = toISODate(new Date());

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Schichtplan"
        description="Dienste, Urlaub und Krankheit je Fahrer im Wochenkalender – Doppelbelegungen werden automatisch erkannt."
        icon={CalendarDays}
        badge="Personalplanung"
      />

      <Card className="border-border/70 shadow-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setAnkerDatum((d) => addDays(d, -7))}
              aria-label="Vorherige Woche"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnkerDatum(startOfWeek(new Date()))}
            >
              Heute
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setAnkerDatum((d) => addDays(d, 7))}
              aria-label="Nächste Woche"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <CardTitle className="ml-2 text-base">
              {tage[0].toLocaleDateString("de-DE", { day: "2-digit", month: "short" })} –{" "}
              {tage[6].toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </CardTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SHIFT_TYPEN.map((t) => (
              <span key={t} className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className={cn("h-2.5 w-2.5 rounded-full", SHIFT_META[t].dot)} />
                {SHIFT_META[t].label}
              </span>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {konflikte.size > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {konflikte.size} Doppelbelegung(en) erkannt – rot umrandete Einträge prüfen.
            </div>
          )}
          {isLoading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Kalender wird geladen …</p>
          )}
          {!isLoading && fahrer.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Fahrer angelegt.
            </p>
          )}
          {!isLoading && fahrer.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="w-40 text-left text-xs font-medium text-muted-foreground">
                      Fahrer
                    </th>
                    {tage.map((d, i) => {
                      const iso = tageISO[i];
                      return (
                        <th
                          key={iso}
                          className={cn(
                            "min-w-[92px] rounded-md px-1 py-1 text-center text-xs font-medium",
                            iso === heuteISO
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {WEEKDAYS[i]}
                          <br />
                          {d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {fahrer.map((f) => (
                    <tr key={f.id}>
                      <td className="truncate pr-2 text-sm font-medium">{f.name}</td>
                      {tageISO.map((iso) => {
                        const eintraege = shiftsFuer(f.id, iso);
                        return (
                          <td key={iso} className="align-top">
                            <button
                              type="button"
                              onClick={() => setZelle({ driverId: f.id, datum: iso })}
                              className="flex min-h-[52px] w-full flex-col gap-1 rounded-md border border-border/60 bg-muted/20 p-1 text-left transition-colors hover:bg-muted/50"
                            >
                              {eintraege.length === 0 && (
                                <span className="m-auto text-muted-foreground/40">
                                  <Plus className="h-3.5 w-3.5" />
                                </span>
                              )}
                              {eintraege.map((s) => (
                                <span
                                  key={s.id}
                                  className={cn(
                                    "rounded px-1 py-0.5 text-[10px] font-medium",
                                    SHIFT_META[s.typ].badge,
                                    konflikte.has(s.id) && "ring-1 ring-destructive",
                                  )}
                                >
                                  {SHIFT_META[s.typ].label}
                                  {s.von && ` ${s.von}`}
                                  {s.bis && `–${s.bis}`}
                                </span>
                              ))}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ZellenDialog
        zelle={zelle}
        onClose={() => setZelle(null)}
        fahrerName={fahrer.find((f) => f.id === zelle?.driverId)?.name ?? ""}
        eintraege={zelle ? shiftsFuer(zelle.driverId, zelle.datum) : []}
      />
    </div>
  );
}

function ZellenDialog({
  zelle,
  onClose,
  fahrerName,
  eintraege,
}: {
  zelle: { driverId: string; datum: string } | null;
  onClose: () => void;
  fahrerName: string;
  eintraege: Shift[];
}) {
  const createMut = useCreateShift();
  const deleteMut = useDeleteShift();
  const [typ, setTyp] = useState<ShiftTyp>("dienst");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [notiz, setNotiz] = useState("");

  const hinzufuegen = () => {
    if (!zelle) return;
    createMut.mutate(
      { driverId: zelle.driverId, datum: zelle.datum, typ, von, bis, notiz },
      {
        onSuccess: () => {
          toast.success("Eintrag hinzugefügt");
          setVon("");
          setBis("");
          setNotiz("");
          setTyp("dienst");
        },
        onError: (e) => toast.error("Speichern fehlgeschlagen", { description: String(e) }),
      },
    );
  };

  const entfernen = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => toast.success("Eintrag entfernt"),
      onError: (e) => toast.error("Löschen fehlgeschlagen", { description: String(e) }),
    });
  };

  const datumLabel = zelle
    ? new Date(zelle.datum).toLocaleDateString("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      })
    : "";

  return (
    <Dialog open={zelle !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fahrerName}</DialogTitle>
          <DialogDescription>{datumLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {eintraege.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Einträge für diesen Tag.</p>
          )}
          {eintraege.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 p-2"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-[10px]", SHIFT_META[s.typ].badge)}>
                  {SHIFT_META[s.typ].label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {s.von && `${s.von}`}
                  {s.bis && `–${s.bis}`}
                  {s.notiz && ` · ${s.notiz}`}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => entfernen(s.id)}
                aria-label="Entfernen"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Neuer Eintrag
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Art</Label>
              <Select value={typ} onValueChange={(v) => setTyp(v as ShiftTyp)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_TYPEN.map((t) => (
                    <SelectItem key={t} value={t}>
                      {SHIFT_META[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Von</Label>
              <Input type="time" value={von} onChange={(e) => setVon(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Bis</Label>
              <Input type="time" value={bis} onChange={(e) => setBis(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notiz</Label>
            <Input value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Schließen
          </Button>
          <Button onClick={hinzufuegen} disabled={createMut.isPending}>
            {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            <Plus className="h-4 w-4" /> Hinzufügen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
