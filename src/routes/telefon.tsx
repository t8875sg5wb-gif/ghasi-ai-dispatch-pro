import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Phone,
  Plus,
  Search,
  Sparkles,
  PhoneCall,
  Clock,
  User,
  FileText,
  ClipboardList,
  CheckCircle2,
} from "lucide-react";

import {
  ANRUF_RICHTUNG_META,
  ANRUF_STATUS_META,
  ANRUF_KATEGORIEN,
  berechneStatistik,
  formatDauer,
  formatZeitpunkt,
  nextAnrufId,
  type Anruf,
  type AnrufRichtung,
  type AnrufStatus,
  type AnrufKategorie,
} from "@/lib/telefon";
import {
  useCalls,
  useCreateCall,
  useUpdateCall,
  useSeedCalls,
} from "@/lib/calls-store";
import type { CallWrite } from "@/lib/calls-shared";
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

export const Route = createFileRoute("/telefon")({
  head: () => ({
    meta: [
      { title: "Telefon – GHASI AI" },
      {
        name: "description",
        content: "Anrufannahme, Rückrufliste, Gesprächsnotizen und Anrufstatistik.",
      },
    ],
  }),
  component: TelefonSeite,
});

type StatusFilter = AnrufStatus | "alle";
type RichtungFilter = AnrufRichtung | "alle";

function TelefonSeite() {
  const { name: akteur } = useAuth();
  const navigate = useNavigate();
  const { data: anrufe = [] } = useCalls();
  const createMut = useCreateCall();
  const updateMut = useUpdateCall();
  const seedMut = useSeedCalls();
  const [suche, setSuche] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  const [richtungFilter, setRichtungFilter] = useState<RichtungFilter>("alle");
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Anruf | null>(null);

  const stats = useMemo(() => berechneStatistik(anrufe), [anrufe]);
  const hinweise = useMemo(() => buildHinweise(anrufe), [anrufe]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return [...anrufe]
      .sort((a, b) => new Date(b.zeitpunkt).getTime() - new Date(a.zeitpunkt).getTime())
      .filter((a) => {
        if (statusFilter !== "alle" && a.status !== statusFilter) return false;
        if (richtungFilter !== "alle" && a.richtung !== richtungFilter) return false;
        if (!q) return true;
        return (
          (a.name ?? "").toLowerCase().includes(q) ||
          a.nummer.toLowerCase().includes(q) ||
          (a.notiz ?? "").toLowerCase().includes(q)
        );
      });
  }, [anrufe, suche, statusFilter, richtungFilter]);

  const selektiert = anrufe.find((a) => a.id === aktiv) ?? gefiltert[0] ?? null;

  function speichern(values: Anruf) {
    const istNeu = !anrufe.some((a) => a.id === values.id);
    const { id: _id, ...write } = values;
    void _id;
    const onDone = () => {
      setFormOpen(false);
      setEditTarget(null);
      logActivity({
        bereich: "Telefon",
        entitaet: values.name ?? values.nummer,
        aktion: istNeu ? "Anruf erfasst" : "Anruf bearbeitet",
        beschreibung: `${ANRUF_RICHTUNG_META[values.richtung].label}er Anruf (${values.kategorie}) wurde ${istNeu ? "erfasst" : "aktualisiert"}.`,
        akteur,
      });
      toast.success(`Anruf ${istNeu ? "erfasst" : "gespeichert"}`);
    };
    const onErr = (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    if (istNeu) {
      createMut.mutate(write as CallWrite, {
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

  function setStatus(anruf: Anruf, status: AnrufStatus) {
    updateMut.mutate(
      { id: anruf.id, values: { status } },
      {
        onSuccess: () =>
          logActivity({
            bereich: "Telefon",
            entitaet: anruf.name ?? anruf.nummer,
            aktion: "Status geändert",
            beschreibung: `Anruf auf „${ANRUF_STATUS_META[status].label}“ gesetzt.`,
            akteur,
          }),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen"),
      },
    );
  }

  function auftragAusAnruf(anruf: Anruf) {
    updateMut.mutate({ id: anruf.id, values: { auftragErstellt: true, status: "erledigt" } });
    logActivity({
      bereich: "Telefon",
      entitaet: anruf.name ?? anruf.nummer,
      aktion: "Auftrag aus Anruf",
      beschreibung: `Aus dem Anruf von ${anruf.name ?? anruf.nummer} wird ein Auftrag vorbereitet.`,
      akteur,
    });
    toast.success("Auftrag wird angelegt – weiter zur Auftragserfassung");
    void navigate({ to: "/auftraege" });
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Telefon</h1>
            <p className="text-sm text-muted-foreground">
              Anrufprotokoll, Rückrufliste, Gesprächsnotizen und Statistik.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {anrufe.length === 0 && (
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
            <Plus className="mr-1.5 h-4 w-4" /> Anruf erfassen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Kpi label="Anrufe gesamt" value={String(stats.gesamt)} icon={PhoneCall} />
        <Kpi label="Eingehend" value={String(stats.eingehend)} icon={Phone} />
        <Kpi
          label="Offen / Rückruf"
          value={String(stats.offen)}
          icon={ClipboardList}
          tone="warning"
        />
        <Kpi label="Ø Dauer" value={formatDauer(stats.schnittDauer)} icon={Clock} />
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

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader className="space-y-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name, Nummer, Notiz…"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={richtungFilter}
                onValueChange={(v) => setRichtungFilter(v as RichtungFilter)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Richtungen</SelectItem>
                  {(Object.keys(ANRUF_RICHTUNG_META) as AnrufRichtung[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ANRUF_RICHTUNG_META[r].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alle">Alle Status</SelectItem>
                  {(Object.keys(ANRUF_STATUS_META) as AnrufStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {ANRUF_STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {gefiltert.map((a) => {
              const rmeta = ANRUF_RICHTUNG_META[a.richtung];
              const smeta = ANRUF_STATUS_META[a.status];
              return (
                <button
                  key={a.id}
                  onClick={() => setAktiv(a.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    selektiert?.id === a.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">
                      <rmeta.icon className={cn("h-4 w-4", rmeta.color)} />
                      {a.name ?? a.nummer}
                    </span>
                    <Badge variant="outline" className={cn("text-[10px]", smeta.badge)}>
                      {smeta.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.kategorie} · {formatZeitpunkt(a.zeitpunkt)}
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
          <AnrufDetail
            anruf={selektiert}
            onEdit={() => {
              setEditTarget(selektiert);
              setFormOpen(true);
            }}
            onStatus={(s) => setStatus(selektiert, s)}
            onAuftrag={() => auftragAusAnruf(selektiert)}
          />
        )}
      </div>

      <AnrufForm
        open={formOpen}
        target={editTarget}
        existing={anrufe}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSave={speichern}
      />
    </div>
  );
}

function buildHinweise(anrufe: Anruf[]): string[] {
  const out: string[] = [];
  const rueckruf = anrufe.filter((a) => a.status === "rueckruf");
  if (rueckruf.length > 0)
    out.push(
      `${rueckruf.length} Rückruf(e) offen – z. B. ${rueckruf[0].name ?? rueckruf[0].nummer}.`,
    );
  const vm = anrufe.filter((a) => a.richtung === "voicemail" && a.status !== "erledigt");
  if (vm.length > 0) out.push(`${vm.length} unbearbeitete Voicemail(s) abhören.`);
  const beschwerden = anrufe.filter((a) => a.kategorie === "Beschwerde" && a.status !== "erledigt");
  if (beschwerden.length > 0)
    out.push(
      `${beschwerden.length} offene Beschwerde(n) – zeitnah klären, um Kundenbindung zu sichern.`,
    );
  if (out.length === 0) out.push("Keine offenen Rückrufe oder Voicemails – alles bearbeitet.");
  return out.slice(0, 4);
}

function AnrufDetail({
  anruf,
  onEdit,
  onStatus,
  onAuftrag,
}: {
  anruf: Anruf;
  onEdit: () => void;
  onStatus: (s: AnrufStatus) => void;
  onAuftrag: () => void;
}) {
  const rmeta = ANRUF_RICHTUNG_META[anruf.richtung];
  const smeta = ANRUF_STATUS_META[anruf.status];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <rmeta.icon className={cn("h-5 w-5", rmeta.color)} />
              {anruf.name ?? anruf.nummer}
            </span>
            <Badge variant="outline" className={cn(smeta.badge)}>
              {smeta.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Zeile icon={Phone} label="Nummer" value={anruf.nummer} />
            <Zeile icon={rmeta.icon} label="Richtung" value={rmeta.label} />
            <Zeile icon={Clock} label="Zeitpunkt" value={formatZeitpunkt(anruf.zeitpunkt)} />
            <Zeile icon={Clock} label="Dauer" value={formatDauer(anruf.dauerSek)} />
            <Zeile icon={FileText} label="Kategorie" value={anruf.kategorie} />
            {anruf.auftragErstellt && (
              <Zeile icon={CheckCircle2} label="Auftrag" value="Aus Anruf erstellt" />
            )}
          </div>
          {anruf.notiz && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Gesprächsnotiz</p>
              <p className="text-sm">{anruf.notiz}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              Bearbeiten
            </Button>
            {anruf.status !== "erledigt" && (
              <Button variant="outline" size="sm" onClick={() => onStatus("erledigt")}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Erledigt
              </Button>
            )}
            {anruf.status !== "rueckruf" && (
              <Button variant="outline" size="sm" onClick={() => onStatus("rueckruf")}>
                Rückruf vormerken
              </Button>
            )}
            {!anruf.auftragErstellt && (
              <Button size="sm" onClick={onAuftrag}>
                <ClipboardList className="mr-1.5 h-4 w-4" /> Auftrag aus Anruf
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AnrufForm({
  open,
  target,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  target: Anruf | null;
  existing: Anruf[];
  onClose: () => void;
  onSave: (a: Anruf) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target ? "Anruf bearbeiten" : "Anruf erfassen"}</DialogTitle>
          <DialogDescription>Gesprächsdaten und Notiz für die Nachverfolgung.</DialogDescription>
        </DialogHeader>
        {open && (
          <AnrufFelder target={target} existing={existing} onClose={onClose} onSave={onSave} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnrufFelder({
  target,
  existing,
  onClose,
  onSave,
}: {
  target: Anruf | null;
  existing: Anruf[];
  onClose: () => void;
  onSave: (a: Anruf) => void;
}) {
  const [richtung, setRichtung] = useState<AnrufRichtung>(target?.richtung ?? "eingehend");
  const [nummer, setNummer] = useState(target?.nummer ?? "");
  const [name, setName] = useState(target?.name ?? "");
  const [kategorie, setKategorie] = useState<AnrufKategorie>(target?.kategorie ?? "Auftrag");
  const [status, setStatus] = useState<AnrufStatus>(target?.status ?? "offen");
  const [dauerMin, setDauerMin] = useState(target ? String(Math.round(target.dauerSek / 60)) : "0");
  const [notiz, setNotiz] = useState(target?.notiz ?? "");

  function submit() {
    if (!nummer.trim()) {
      toast.error("Telefonnummer ist erforderlich.");
      return;
    }
    onSave({
      id: target?.id ?? nextAnrufId(existing),
      richtung,
      nummer: nummer.trim(),
      name: name.trim() || undefined,
      zeitpunkt: target?.zeitpunkt ?? new Date().toISOString(),
      dauerSek: Math.max(0, Math.round(Number(dauerMin || "0") * 60)),
      kategorie,
      status,
      notiz: notiz.trim() || undefined,
      auftragErstellt: target?.auftragErstellt,
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Richtung">
          <Select value={richtung} onValueChange={(v) => setRichtung(v as AnrufRichtung)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ANRUF_RICHTUNG_META) as AnrufRichtung[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ANRUF_RICHTUNG_META[r].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Feld>
        <Feld label="Kategorie">
          <Select value={kategorie} onValueChange={(v) => setKategorie(v as AnrufKategorie)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANRUF_KATEGORIEN.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Feld>
        <Feld label="Telefonnummer *">
          <Input value={nummer} onChange={(e) => setNummer(e.target.value)} />
        </Feld>
        <Feld label="Name / Kontakt">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Feld>
        <Feld label="Dauer (Minuten)">
          <Input type="number" value={dauerMin} onChange={(e) => setDauerMin(e.target.value)} />
        </Feld>
        <Feld label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v as AnrufStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ANRUF_STATUS_META) as AnrufStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {ANRUF_STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Feld>
      </div>
      <Feld label="Gesprächsnotiz">
        <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={3} />
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

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Phone;
  tone?: "warning";
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary",
          )}
        >
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

function Zeile({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
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
