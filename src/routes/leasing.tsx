import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CarFront,
  Plus,
  Search,
  Sparkles,
  Truck,
  CalendarClock,
  Euro,
  FileText,
  Gauge,
} from "lucide-react";

import {
  LEASING_STATUS_META,
  abgeleiteterLeasingStatus,
  tageBisEnde,
  kmAuslastung,
  nextLeasingId,
  formatEUR,
  type Leasingvertrag,
} from "@/lib/leasing";
import {
  useLeasing,
  useCreateLeasing,
  useUpdateLeasing,
  useSeedLeasing,
} from "@/lib/leasing-store";
import type { LeasingWrite } from "@/lib/leasing-shared";
import { type Fahrzeug } from "@/lib/fahrzeuge";
import { useVehicles } from "@/lib/vehicles-store";
import { useVehicleOptions } from "@/hooks/use-entity-options";
import { logActivity } from "@/lib/protokoll";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leasing")({
  head: () => ({
    meta: [
      { title: "Leasing – GHASI AI" },
      {
        name: "description",
        content: "Leasing- und Finanzierungsverträge, Raten, Laufzeiten und Kilometer.",
      },
    ],
  }),
  component: LeasingSeite,
});



function LeasingSeite() {
  const { name: akteur } = useAuth();
  const { data: items = [] } = useLeasing();
  const createMut = useCreateLeasing();
  const updateMut = useUpdateLeasing();
  const seedMut = useSeedLeasing();
  const [suche, setSuche] = useState("");
  const [nurAktiv, setNurAktiv] = useState(false);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Leasingvertrag | null>(null);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return items.filter((l) => {
      if (nurAktiv && abgeleiteterLeasingStatus(l) === "beendet") return false;
      if (!q) return true;
      return (
        l.leasinggeber.toLowerCase().includes(q) ||
        l.vertragsnummer.toLowerCase().includes(q) ||
        l.fahrzeug.toLowerCase().includes(q)
      );
    });
  }, [items, suche, nurAktiv]);

  const selektiert = items.find((l) => l.id === aktiv) ?? gefiltert[0] ?? null;
  const monatsrate = items.reduce((s, l) => s + l.rateMonat, 0);
  const { data: vehicles = [] } = useVehicles();
  const hinweise = useMemo(() => buildHinweise(items, vehicles), [items, vehicles]);

  function speichern(values: Leasingvertrag) {
    const istNeu = !items.some((l) => l.id === values.id);
    const { id: _id, ...write } = values;
    void _id;
    const onDone = () => {
      setFormOpen(false);
      setEditTarget(null);
      logActivity({
        bereich: "Leasing",
        entitaet: `${values.vertragsnummer} · ${values.fahrzeug}`,
        aktion: istNeu ? "angelegt" : "bearbeitet",
        beschreibung: `Leasingvertrag ${values.vertragsnummer} (${values.leasinggeber}) wurde ${istNeu ? "angelegt" : "aktualisiert"}.`,
        akteur,
      });
      toast.success(`Leasingvertrag ${istNeu ? "angelegt" : "gespeichert"}`);
    };
    const onErr = (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    if (istNeu) {
      createMut.mutate(write as LeasingWrite, {
        onSuccess: (row) => {
          setAktiv(row.id);
          onDone();
        },
        onError: onErr,
      });
    } else {
      updateMut.mutate(
        { id: values.id, values: write },
        {
          onSuccess: () => {
            setAktiv(values.id);
            onDone();
          },
          onError: onErr,
        },
      );
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CarFront className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Leasing</h1>
            <p className="text-sm text-muted-foreground">
              Leasing- & Finanzierungsverträge, Raten, Laufzeiten und Kilometer.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {items.length === 0 && (
            <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
              Beispieldaten laden
            </Button>
          )}
          <Button
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Vertrag anlegen
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Verträge" value={String(items.length)} icon={FileText} />
        <Kpi label="Rate / Monat" value={formatEUR(monatsrate)} icon={Euro} />
        <Kpi label="Rate / Jahr" value={formatEUR(monatsrate * 12)} icon={CalendarClock} />
      </div>

      {hinweise.length > 0 && (
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-accent" /> GHASI AI Hinweise
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {hinweise.map((h, i) => (
              <p key={i} className="text-sm text-muted-foreground">
                • {h}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader className="space-y-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Vertrag, Leasinggeber, Fahrzeug…"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                className="pl-9"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={nurAktiv}
                onChange={(e) => setNurAktiv(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              Nur laufende Verträge
            </label>
          </CardHeader>
          <CardContent className="space-y-1">
            {gefiltert.map((l) => {
              const status = abgeleiteterLeasingStatus(l);
              const meta = LEASING_STATUS_META[status];
              return (
                <button
                  key={l.id}
                  onClick={() => setAktiv(l.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    selektiert?.id === l.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{l.fahrzeug}</span>
                    <Badge variant="outline" className={cn("gap-1 text-[10px]", meta.badge)}>
                      <meta.icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {l.leasinggeber} · {formatEUR(l.rateMonat)}/Mon.
                  </p>
                </button>
              );
            })}
            {gefiltert.length === 0 && (
              <p className="px-1 py-4 text-sm text-muted-foreground">Keine Treffer.</p>
            )}
          </CardContent>
        </Card>

        {selektiert && (
          <LeasingDetail
            vertrag={selektiert}
            vehicles={vehicles}
            onEdit={() => {
              setEditTarget(selektiert);
              setFormOpen(true);
            }}
          />
        )}
      </div>

      <LeasingForm
        open={formOpen}
        target={editTarget}
        existing={items}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSave={speichern}
      />
    </div>
  );
}

function buildHinweise(items: Leasingvertrag[], vehicles: Fahrzeug[]): string[] {
  const out: string[] = [];
  for (const l of items) {
    const tage = tageBisEnde(l.ende);
    if (l.status !== "beendet" && tage <= 120 && tage >= 0)
      out.push(
        `Vertrag ${l.vertragsnummer} (${l.fahrzeug}) endet in ${tage} Tagen – Anschluss planen.`,
      );
    if (kmAuslastung(l) >= 90 && l.status !== "beendet")
      out.push(
        `${l.fahrzeug}: ${kmAuslastung(l)} % der Inklusiv-Kilometer erreicht – Mehrkilometer drohen.`,
      );
  }
  const ohne = vehicles.filter((f) => !items.some((l) => l.fahrzeug === f.kennzeichen));
  if (ohne.length > 0)
    out.push(
      `${ohne.length} Fahrzeug(e) ohne Leasingvertrag (evtl. Eigentum): ${ohne.map((f) => f.kennzeichen).join(", ")}.`,
    );
  if (out.length === 0) out.push("Alle Verträge laufen planmäßig, keine kritischen Laufzeiten.");
  return out.slice(0, 4);
}

function LeasingDetail({
  vertrag: l,
  vehicles,
  onEdit,
}: {
  vertrag: Leasingvertrag;
  vehicles: Fahrzeug[];
  onEdit: () => void;
}) {
  const status = abgeleiteterLeasingStatus(l);
  const meta = LEASING_STATUS_META[status];
  const fahrzeug = vehicles.find((f) => f.kennzeichen === l.fahrzeug);
  const auslastung = kmAuslastung(l);
  const tage = tageBisEnde(l.ende);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              {l.fahrzeug}
              <Badge variant="outline" className={cn("gap-1", meta.badge)}>
                <meta.icon className="h-3.5 w-3.5" />
                {meta.label}
              </Badge>
            </span>
            <Button variant="outline" size="sm" onClick={onEdit}>
              Bearbeiten
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Zeile icon={FileText} label="Leasinggeber" value={l.leasinggeber} />
            <Zeile icon={FileText} label="Vertragsnummer" value={l.vertragsnummer} />
            <Zeile icon={Euro} label="Rate / Monat" value={formatEUR(l.rateMonat)} />
            <Zeile icon={Euro} label="Restwert" value={formatEUR(l.restwert)} />
            <Zeile
              icon={CalendarClock}
              label="Laufzeit"
              value={`${formatDatum(l.beginn)} – ${formatDatum(l.ende)} (${l.laufzeitMonate} Mon.)`}
            />
            <Zeile
              icon={Gauge}
              label="Kilometer"
              value={`${l.kmAktuell.toLocaleString("de-DE")} / ${l.kmInklusive.toLocaleString("de-DE")} km`}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Kilometer-Auslastung</span>
              <span className={cn("font-medium", auslastung >= 90 && "text-warning")}>
                {auslastung} %
              </span>
            </div>
            <Progress value={Math.min(auslastung, 100)} className="h-2" />
          </div>

          {l.status !== "beendet" && tage <= 120 && tage >= 0 && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              Vertrag endet in {tage} Tagen – Anschlussfahrzeug oder Verlängerung planen.
            </p>
          )}
          {l.notiz && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Notiz</p>
              <p className="text-sm">{l.notiz}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {fahrzeug && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4" /> Verknüpftes Fahrzeug
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border/70 p-3">
              <p className="text-sm font-semibold">
                {fahrzeug.nummer} · {fahrzeug.marke} {fahrzeug.modell}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fahrzeug.kennzeichen} · {fahrzeug.typ} · Baujahr {fahrzeug.baujahr}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LeasingForm({
  open,
  target,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  target: Leasingvertrag | null;
  existing: Leasingvertrag[];
  onClose: () => void;
  onSave: (l: Leasingvertrag) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target ? "Vertrag bearbeiten" : "Vertrag anlegen"}</DialogTitle>
          <DialogDescription>Leasingdaten für Flotte und Buchhaltung.</DialogDescription>
        </DialogHeader>
        {open && (
          <LeasingFelder target={target} existing={existing} onClose={onClose} onSave={onSave} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LeasingFelder({
  target,
  existing,
  onClose,
  onSave,
}: {
  target: Leasingvertrag | null;
  existing: Leasingvertrag[];
  onClose: () => void;
  onSave: (l: Leasingvertrag) => void;
}) {
  const [leasinggeber, setLeasinggeber] = useState(target?.leasinggeber ?? "");
  const [vertragsnummer, setVertragsnummer] = useState(target?.vertragsnummer ?? "");
  const [fahrzeug, setFahrzeug] = useState(target?.fahrzeug ?? FAHRZEUG_OPTIONEN[0] ?? "");
  const [rateMonat, setRateMonat] = useState(String(target?.rateMonat ?? ""));
  const [restwert, setRestwert] = useState(String(target?.restwert ?? ""));
  const [laufzeit, setLaufzeit] = useState(String(target?.laufzeitMonate ?? "36"));
  const [kmInklusive, setKmInklusive] = useState(String(target?.kmInklusive ?? ""));
  const [kmAktuell, setKmAktuell] = useState(String(target?.kmAktuell ?? "0"));
  const [beginn, setBeginn] = useState(target?.beginn ?? "");
  const [ende, setEnde] = useState(target?.ende ?? "");
  const [notiz, setNotiz] = useState(target?.notiz ?? "");

  function submit() {
    if (!leasinggeber.trim() || !vertragsnummer.trim() || !rateMonat.trim()) {
      toast.error("Leasinggeber, Vertragsnummer und Rate sind erforderlich.");
      return;
    }
    onSave({
      id: target?.id ?? nextLeasingId(existing),
      leasinggeber: leasinggeber.trim(),
      vertragsnummer: vertragsnummer.trim(),
      fahrzeug,
      rateMonat: Number(rateMonat),
      beginn: beginn || new Date().toISOString().slice(0, 10),
      ende: ende || new Date(Date.now() + 1095 * 86_400_000).toISOString().slice(0, 10),
      restwert: Number(restwert || "0"),
      laufzeitMonate: Number(laufzeit || "36"),
      kmInklusive: Number(kmInklusive || "0"),
      kmAktuell: Number(kmAktuell || "0"),
      status: target?.status ?? "aktiv",
      notiz: notiz.trim() || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Leasinggeber *">
          <Input value={leasinggeber} onChange={(e) => setLeasinggeber(e.target.value)} />
        </Feld>
        <Feld label="Vertragsnummer *">
          <Input value={vertragsnummer} onChange={(e) => setVertragsnummer(e.target.value)} />
        </Feld>
        <Feld label="Fahrzeug">
          <Select value={fahrzeug} onValueChange={setFahrzeug}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FAHRZEUG_OPTIONEN.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Feld>
        <Feld label="Rate / Monat (EUR) *">
          <Input type="number" value={rateMonat} onChange={(e) => setRateMonat(e.target.value)} />
        </Feld>
        <Feld label="Restwert (EUR)">
          <Input type="number" value={restwert} onChange={(e) => setRestwert(e.target.value)} />
        </Feld>
        <Feld label="Laufzeit (Monate)">
          <Input type="number" value={laufzeit} onChange={(e) => setLaufzeit(e.target.value)} />
        </Feld>
        <Feld label="Inklusiv-km">
          <Input
            type="number"
            value={kmInklusive}
            onChange={(e) => setKmInklusive(e.target.value)}
          />
        </Feld>
        <Feld label="Aktueller km-Stand">
          <Input type="number" value={kmAktuell} onChange={(e) => setKmAktuell(e.target.value)} />
        </Feld>
        <Feld label="Beginn">
          <Input type="date" value={beginn} onChange={(e) => setBeginn(e.target.value)} />
        </Feld>
        <Feld label="Ende">
          <Input type="date" value={ende} onChange={(e) => setEnde(e.target.value)} />
        </Feld>
      </div>
      <Feld label="Notiz">
        <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} />
      </Feld>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button onClick={submit}>Speichern</Button>
      </DialogFooter>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Euro }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Zeile({ icon: Icon, label, value }: { icon: typeof Euro; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function Feld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
