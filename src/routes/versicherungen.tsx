import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  Plus,
  Search,
  Sparkles,
  Truck,
  CalendarClock,
  Euro,
  FileText,
} from "lucide-react";

import {
  INITIAL_VERSICHERUNGEN,
  VERSICHERUNGS_ARTEN,
  VERSICHERUNG_STATUS_META,
  abgeleiteterStatus,
  tageBisAblauf,
  nextVersicherungId,
  formatEUR,
  type Versicherung,
  type VersicherungsArt,
} from "@/lib/versicherungen";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";
import { logActivity } from "@/lib/protokoll";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

export const Route = createFileRoute("/versicherungen")({
  head: () => ({
    meta: [
      { title: "Versicherungen – GHASI AI" },
      {
        name: "description",
        content: "Fahrzeug- und Betriebsversicherungen, Beiträge und Laufzeiten.",
      },
    ],
  }),
  component: VersicherungenSeite,
});

const FAHRZEUG_OPTIONEN = ["Flotte", ...INITIAL_FAHRZEUGE.map((f) => f.kennzeichen)];

type ArtFilter = VersicherungsArt | "alle";

function VersicherungenSeite() {
  const { name: akteur } = useAuth();
  const [items, setItems] = useState<Versicherung[]>(INITIAL_VERSICHERUNGEN);
  const [suche, setSuche] = useState("");
  const [artFilter, setArtFilter] = useState<ArtFilter>("alle");
  const [aktiv, setAktiv] = useState<string | null>(INITIAL_VERSICHERUNGEN[0]?.id ?? null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Versicherung | null>(null);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return items.filter((v) => {
      if (artFilter !== "alle" && v.art !== artFilter) return false;
      if (!q) return true;
      return (
        v.versicherer.toLowerCase().includes(q) ||
        v.policennummer.toLowerCase().includes(q) ||
        v.fahrzeug.toLowerCase().includes(q)
      );
    });
  }, [items, suche, artFilter]);

  const selektiert = items.find((v) => v.id === aktiv) ?? gefiltert[0] ?? null;
  const monatsbeitrag = items.reduce((s, v) => s + v.beitragMonat, 0);
  const hinweise = useMemo(() => buildHinweise(items), [items]);

  function speichern(values: Versicherung) {
    const istNeu = !items.some((v) => v.id === values.id);
    setItems((prev) =>
      istNeu ? [...prev, values] : prev.map((v) => (v.id === values.id ? values : v)),
    );
    setAktiv(values.id);
    setFormOpen(false);
    setEditTarget(null);
    logActivity({
      bereich: "Versicherungen",
      entitaet: `${values.art} · ${values.fahrzeug}`,
      aktion: istNeu ? "angelegt" : "bearbeitet",
      beschreibung: `Police ${values.policennummer} (${values.versicherer}) wurde ${istNeu ? "angelegt" : "aktualisiert"}.`,
      akteur,
    });
    toast.success(`Versicherung ${istNeu ? "angelegt" : "gespeichert"}`);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Versicherungen</h1>
            <p className="text-sm text-muted-foreground">
              Policen, Beiträge, Laufzeiten und Selbstbeteiligungen der Flotte.
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Police anlegen
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Policen aktiv" value={String(items.length)} icon={ShieldCheck} />
        <Kpi label="Beitrag / Monat" value={formatEUR(monatsbeitrag)} icon={Euro} />
        <Kpi label="Beitrag / Jahr" value={formatEUR(monatsbeitrag * 12)} icon={CalendarClock} />
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
                placeholder="Police, Versicherer, Fahrzeug…"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={artFilter} onValueChange={(v) => setArtFilter(v as ArtFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Arten</SelectItem>
                {VERSICHERUNGS_ARTEN.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-1">
            {gefiltert.map((v) => {
              const status = abgeleiteterStatus(v);
              const meta = VERSICHERUNG_STATUS_META[status];
              return (
                <button
                  key={v.id}
                  onClick={() => setAktiv(v.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    selektiert?.id === v.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{v.art}</span>
                    <Badge variant="outline" className={cn("gap-1 text-[10px]", meta.badge)}>
                      <meta.icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {v.versicherer} · {v.fahrzeug}
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
          <VersicherungDetail
            versicherung={selektiert}
            onEdit={() => {
              setEditTarget(selektiert);
              setFormOpen(true);
            }}
          />
        )}
      </div>

      <VersicherungForm
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

function buildHinweise(items: Versicherung[]): string[] {
  const out: string[] = [];
  for (const v of items) {
    const tage = tageBisAblauf(v.ablauf);
    if (v.status !== "gekuendigt" && tage <= 60 && tage >= 0) {
      out.push(
        `Police ${v.policennummer} (${v.fahrzeug}) läuft in ${tage} Tagen ab – Verlängerung prüfen.`,
      );
    }
  }
  const ohne = INITIAL_FAHRZEUGE.filter(
    (f) => !items.some((v) => v.fahrzeug === f.kennzeichen && v.art === "Haftpflicht"),
  );
  if (ohne.length > 0)
    out.push(
      `${ohne.length} Fahrzeug(e) ohne erfasste Haftpflicht: ${ohne.map((f) => f.kennzeichen).join(", ")}.`,
    );
  if (out.length === 0) out.push("Alle Policen sind aktiv und langfristig gültig.");
  return out.slice(0, 4);
}

function VersicherungDetail({
  versicherung: v,
  onEdit,
}: {
  versicherung: Versicherung;
  onEdit: () => void;
}) {
  const status = abgeleiteterStatus(v);
  const meta = VERSICHERUNG_STATUS_META[status];
  const fahrzeug = INITIAL_FAHRZEUGE.find((f) => f.kennzeichen === v.fahrzeug);
  const tage = tageBisAblauf(v.ablauf);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              {v.art}
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
            <Zeile icon={ShieldCheck} label="Versicherer" value={v.versicherer} />
            <Zeile icon={FileText} label="Policennummer" value={v.policennummer} />
            <Zeile icon={Truck} label="Fahrzeug" value={v.fahrzeug} />
            <Zeile icon={Euro} label="Beitrag / Monat" value={formatEUR(v.beitragMonat)} />
            <Zeile icon={Euro} label="Selbstbeteiligung" value={formatEUR(v.selbstbeteiligung)} />
            <Zeile
              icon={CalendarClock}
              label="Laufzeit"
              value={`${formatDatum(v.beginn)} – ${formatDatum(v.ablauf)}`}
            />
          </div>
          {v.status !== "gekuendigt" && tage <= 60 && tage >= 0 && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              Läuft in {tage} Tagen ab – rechtzeitig verlängern.
            </p>
          )}
          {v.notiz && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Notiz</p>
              <p className="text-sm">{v.notiz}</p>
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
                {fahrzeug.kennzeichen} · {fahrzeug.typ} ·{" "}
                {fahrzeug.kilometerstand.toLocaleString("de-DE")} km
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VersicherungForm({
  open,
  target,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  target: Versicherung | null;
  existing: Versicherung[];
  onClose: () => void;
  onSave: (v: Versicherung) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target ? "Police bearbeiten" : "Police anlegen"}</DialogTitle>
          <DialogDescription>Versicherungsdaten für Flotte und Buchhaltung.</DialogDescription>
        </DialogHeader>
        {open && (
          <VersicherungFelder
            target={target}
            existing={existing}
            onClose={onClose}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function VersicherungFelder({
  target,
  existing,
  onClose,
  onSave,
}: {
  target: Versicherung | null;
  existing: Versicherung[];
  onClose: () => void;
  onSave: (v: Versicherung) => void;
}) {
  const [versicherer, setVersicherer] = useState(target?.versicherer ?? "");
  const [policennummer, setPolicennummer] = useState(target?.policennummer ?? "");
  const [art, setArt] = useState<VersicherungsArt>(target?.art ?? "Haftpflicht");
  const [fahrzeug, setFahrzeug] = useState(target?.fahrzeug ?? FAHRZEUG_OPTIONEN[1] ?? "Flotte");
  const [beitragMonat, setBeitragMonat] = useState(String(target?.beitragMonat ?? ""));
  const [selbstbeteiligung, setSelbstbeteiligung] = useState(
    String(target?.selbstbeteiligung ?? "0"),
  );
  const [beginn, setBeginn] = useState(target?.beginn ?? "");
  const [ablauf, setAblauf] = useState(target?.ablauf ?? "");
  const [notiz, setNotiz] = useState(target?.notiz ?? "");

  function submit() {
    if (!versicherer.trim() || !policennummer.trim() || !beitragMonat.trim()) {
      toast.error("Versicherer, Policennummer und Beitrag sind erforderlich.");
      return;
    }
    onSave({
      id: target?.id ?? nextVersicherungId(existing),
      versicherer: versicherer.trim(),
      policennummer: policennummer.trim(),
      art,
      fahrzeug,
      beitragMonat: Number(beitragMonat),
      selbstbeteiligung: Number(selbstbeteiligung || "0"),
      beginn: beginn || new Date().toISOString().slice(0, 10),
      ablauf: ablauf || new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10),
      status: target?.status ?? "aktiv",
      notiz: notiz.trim() || undefined,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Versicherer *">
          <Input value={versicherer} onChange={(e) => setVersicherer(e.target.value)} />
        </Feld>
        <Feld label="Policennummer *">
          <Input value={policennummer} onChange={(e) => setPolicennummer(e.target.value)} />
        </Feld>
        <Feld label="Art">
          <Select value={art} onValueChange={(v) => setArt(v as VersicherungsArt)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERSICHERUNGS_ARTEN.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <Feld label="Beitrag / Monat (EUR) *">
          <Input
            type="number"
            value={beitragMonat}
            onChange={(e) => setBeitragMonat(e.target.value)}
          />
        </Feld>
        <Feld label="Selbstbeteiligung (EUR)">
          <Input
            type="number"
            value={selbstbeteiligung}
            onChange={(e) => setSelbstbeteiligung(e.target.value)}
          />
        </Feld>
        <Feld label="Beginn">
          <Input type="date" value={beginn} onChange={(e) => setBeginn(e.target.value)} />
        </Feld>
        <Feld label="Ablauf">
          <Input type="date" value={ablauf} onChange={(e) => setAblauf(e.target.value)} />
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
