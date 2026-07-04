// Wiederverwendbares Einrichtungs-Modul für GHASI AI.
// Bietet Liste, Suche, Filter, Detailansicht, Anlegen/Bearbeiten und
// verknüpfte Transporte – genutzt von Krankenhäusern, Dialysezentren und Pflegeheimen.
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Plus,
  Search,
  MapPin,
  Phone,
  Mail,
  User,
  Clock,
  Bed,
  Sparkles,
  FileText,
  type LucideIcon,
} from "lucide-react";

import { type Einrichtung, type EinrichtungTyp, nextStammId } from "@/lib/stammdaten";
import {
  useFacilities,
  useCreateFacility,
  useUpdateFacility,
  useSeedFacilities,
} from "@/lib/facilities-store";
import type { FacilityWrite } from "@/lib/facilities-shared";
import { INITIAL_AUFTRAEGE, STATUS_META, formatTermin } from "@/lib/auftraege";
import { logActivity } from "@/lib/protokoll";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AddressFields } from "@/components/forms/address-fields";
import { parseAdresse, formatAdresse, type AdresseStruktur } from "@/lib/address";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ModulConfig {
  typ: EinrichtungTyp;
  titel: string;
  einzahl: string;
  beschreibung: string;
  icon: LucideIcon;
  idPrefix: string;
  daten: Einrichtung[];
  kapazitaetLabel: string;
}

export function EinrichtungModul({ config }: { config: ModulConfig }) {
  const { name: akteur } = useAuth();
  const { data: alle = [] } = useFacilities();
  const createMut = useCreateFacility();
  const updateMut = useUpdateFacility();
  const seedMut = useSeedFacilities();
  const items = useMemo(() => alle.filter((e) => e.typ === config.typ), [alle, config.typ]);
  const [suche, setSuche] = useState("");
  const [nurAktiv, setNurAktiv] = useState(false);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Einrichtung | null>(null);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return items.filter((e) => {
      if (nurAktiv && e.aktiv === false) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.adresse.toLowerCase().includes(q) ||
        e.ansprechpartner.toLowerCase().includes(q) ||
        (e.fachbereiche ?? []).join(" ").toLowerCase().includes(q)
      );
    });
  }, [items, suche, nurAktiv]);

  const selektiert = items.find((e) => e.id === aktiv) ?? gefiltert[0] ?? null;

  const hinweise = useMemo(() => buildHinweise(items, config), [items, config]);

  function speichern(values: Einrichtung) {
    const istNeu = !items.some((e) => e.id === values.id);
    const { id: _id, ...rest } = values;
    void _id;
    const write: FacilityWrite = { ...rest, typ: config.typ };
    const onDone = () => {
      setFormOpen(false);
      setEditTarget(null);
      logActivity({
        bereich: config.titel,
        entitaet: values.name,
        aktion: istNeu ? "angelegt" : "bearbeitet",
        beschreibung: `${config.einzahl} „${values.name}“ wurde ${istNeu ? "angelegt" : "aktualisiert"}.`,
        akteur,
      });
      toast.success(`${config.einzahl} ${istNeu ? "angelegt" : "gespeichert"}`);
    };
    const onErr = (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    if (istNeu) {
      createMut.mutate(write, {
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

  const Icon = config.icon;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{config.titel}</h1>
            <p className="text-sm text-muted-foreground">{config.beschreibung}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {alle.length === 0 && (
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
            <Plus className="mr-1.5 h-4 w-4" /> {config.einzahl} anlegen
          </Button>
        </div>
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

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader className="space-y-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={`${config.einzahl} suchen…`}
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                className="pl-9"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={nurAktiv} onCheckedChange={setNurAktiv} /> Nur aktive
            </label>
          </CardHeader>
          <CardContent className="space-y-1">
            {gefiltert.map((e) => (
              <button
                key={e.id}
                onClick={() => setAktiv(e.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  selektiert?.id === e.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-transparent hover:bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{e.name}</span>
                  {e.aktiv === false && (
                    <Badge variant="outline" className="text-[10px]">
                      Inaktiv
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {e.adresse}
                </p>
              </button>
            ))}
            {gefiltert.length === 0 && (
              <p className="px-1 py-4 text-sm text-muted-foreground">Keine Treffer.</p>
            )}
          </CardContent>
        </Card>

        {selektiert && (
          <EinrichtungDetail
            einrichtung={selektiert}
            config={config}
            onEdit={() => {
              setEditTarget(selektiert);
              setFormOpen(true);
            }}
          />
        )}
      </div>

      <EinrichtungForm
        open={formOpen}
        config={config}
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

function buildHinweise(items: Einrichtung[], config: ModulConfig): string[] {
  const out: string[] = [];
  const inaktiv = items.filter((e) => e.aktiv === false).length;
  if (inaktiv > 0) out.push(`${inaktiv} Einrichtung(en) sind als inaktiv markiert.`);
  for (const e of items) {
    const transporte = transporteFuer(e.name);
    if (transporte.length >= 3) {
      out.push(`„${e.name}“ ist mit ${transporte.length} Transporten ein wichtiger Partner.`);
    }
  }
  if (out.length === 0)
    out.push(`Alle ${config.titel.toLowerCase()} sind aktiv und vollständig erfasst.`);
  return out.slice(0, 4);
}

function transporteFuer(name: string) {
  const n = name.toLowerCase();
  return INITIAL_AUFTRAEGE.filter(
    (a) => a.abholort.toLowerCase().includes(n) || a.zielort.toLowerCase().includes(n),
  );
}

function EinrichtungDetail({
  einrichtung,
  config,
  onEdit,
}: {
  einrichtung: Einrichtung;
  config: ModulConfig;
  onEdit: () => void;
}) {
  const transporte = transporteFuer(einrichtung.name);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>{einrichtung.name}</span>
            <Button variant="outline" size="sm" onClick={onEdit}>
              Bearbeiten
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Zeile icon={MapPin} label="Adresse" value={einrichtung.adresse} />
            <Zeile icon={User} label="Ansprechpartner" value={einrichtung.ansprechpartner} />
            <Zeile icon={Phone} label="Telefon" value={einrichtung.telefon} />
            {einrichtung.email && <Zeile icon={Mail} label="E-Mail" value={einrichtung.email} />}
            {einrichtung.oeffnungszeiten && (
              <Zeile icon={Clock} label="Öffnungszeiten" value={einrichtung.oeffnungszeiten} />
            )}
            {typeof einrichtung.kapazitaet === "number" && (
              <Zeile
                icon={Bed}
                label={config.kapazitaetLabel}
                value={String(einrichtung.kapazitaet)}
              />
            )}
          </div>
          {einrichtung.fachbereiche && einrichtung.fachbereiche.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {einrichtung.fachbereiche.map((f) => (
                <Badge key={f} variant="secondary" className="text-[11px]">
                  {f}
                </Badge>
              ))}
            </div>
          )}
          {einrichtung.notiz && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Notiz</p>
              <p className="text-sm">{einrichtung.notiz}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Verknüpfte Transporte ({transporte.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {transporte.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Transporte zu dieser Einrichtung.</p>
          )}
          {transporte.map((a) => (
            <div key={a.id} className="rounded-xl border border-border/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {a.nummer} · {a.patient}
                </span>
                <Badge variant="outline" className={cn("gap-1", STATUS_META[a.status].badge)}>
                  {STATUS_META[a.status].label}
                </Badge>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {a.abholort} → {a.zielort} · {formatTermin(a.termin)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Zeile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
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

function EinrichtungForm({
  open,
  config,
  target,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  config: ModulConfig;
  target: Einrichtung | null;
  existing: Einrichtung[];
  onClose: () => void;
  onSave: (e: Einrichtung) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {target ? `${config.einzahl} bearbeiten` : `${config.einzahl} anlegen`}
          </DialogTitle>
          <DialogDescription>
            Stammdaten der Einrichtung für Disposition, Abrechnung und GHASI AI.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <FormFelder
            config={config}
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

function FormFelder({
  config,
  target,
  existing,
  onClose,
  onSave,
}: {
  config: ModulConfig;
  target: Einrichtung | null;
  existing: Einrichtung[];
  onClose: () => void;
  onSave: (e: Einrichtung) => void;
}) {
  const [name, setName] = useState(target?.name ?? "");
  const [adr, setAdr] = useState<AdresseStruktur>(() => parseAdresse(target?.adresse ?? ""));
  const [ansprechpartner, setAnsprechpartner] = useState(target?.ansprechpartner ?? "");
  const [telefon, setTelefon] = useState(target?.telefon ?? "");
  const [email, setEmail] = useState(target?.email ?? "");
  const [oeffnungszeiten, setOeffnungszeiten] = useState(target?.oeffnungszeiten ?? "");
  const [kapazitaet, setKapazitaet] = useState(
    typeof target?.kapazitaet === "number" ? String(target.kapazitaet) : "",
  );
  const [fachbereiche, setFachbereiche] = useState((target?.fachbereiche ?? []).join(", "));
  const [notiz, setNotiz] = useState(target?.notiz ?? "");
  const [aktiv, setAktiv] = useState(target?.aktiv ?? true);

  function submit() {
    const adresse = formatAdresse(adr);
    if (!name.trim() || !adresse.trim()) {
      toast.error("Name und Adresse sind erforderlich.");
      return;
    }
    onSave({
      id: target?.id ?? nextStammId(config.idPrefix, existing),
      name: name.trim(),
      adresse: adresse.trim(),
      ansprechpartner: ansprechpartner.trim() || "—",
      telefon: telefon.trim(),
      typ: config.typ,
      email: email.trim() || undefined,
      oeffnungszeiten: oeffnungszeiten.trim() || undefined,
      kapazitaet: kapazitaet.trim() ? Number(kapazitaet) : undefined,
      fachbereiche: fachbereiche
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
      notiz: notiz.trim() || undefined,
      aktiv,
    });
  }

  return (
    <div className="space-y-4">
      <Feld label="Name *">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Feld>
      <AddressFields
        idPrefix="einrichtung-adresse"
        label="Adresse *"
        value={adr}
        onChange={setAdr}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Ansprechpartner">
          <Input value={ansprechpartner} onChange={(e) => setAnsprechpartner(e.target.value)} />
        </Feld>
        <Feld label="Telefon">
          <Input value={telefon} onChange={(e) => setTelefon(e.target.value)} />
        </Feld>
        <Feld label="E-Mail">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Feld>
        <Feld label={config.kapazitaetLabel}>
          <Input type="number" value={kapazitaet} onChange={(e) => setKapazitaet(e.target.value)} />
        </Feld>
      </div>
      <Feld label="Öffnungszeiten">
        <Input value={oeffnungszeiten} onChange={(e) => setOeffnungszeiten(e.target.value)} />
      </Feld>
      <Feld label="Fachbereiche (Komma-getrennt)">
        <Input value={fachbereiche} onChange={(e) => setFachbereiche(e.target.value)} />
      </Feld>
      <Feld label="Notiz">
        <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} />
      </Feld>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={aktiv} onCheckedChange={setAktiv} /> Aktiv
      </label>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button onClick={submit}>Speichern</Button>
      </DialogFooter>
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
