import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AddressFields } from "@/components/forms/address-fields";
import { parseAdresse, formatAdresse, type AdresseStruktur } from "@/lib/address";
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  User,
  FileText,
  Sparkles,
  Euro,
  CreditCard,
  Receipt,
} from "lucide-react";

import { KUNDEN, KUNDEN_TYPEN, VERTRAGS_STATI, nextStammId, type Kunde } from "@/lib/stammdaten";
import { INITIAL_RECHNUNGEN, RECHNUNG_STATUS_META, EUR } from "@/lib/finance";
import { INITIAL_AUFTRAEGE, STATUS_META, formatTermin } from "@/lib/auftraege";
import { logActivity } from "@/lib/protokoll";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

export const Route = createFileRoute("/kunden")({
  head: () => ({
    meta: [
      { title: "Kunden – GHASI AI" },
      {
        name: "description",
        content: "Auftraggeber, Kassen und Vertragspartner zentral verwalten.",
      },
    ],
  }),
  component: KundenSeite,
});

type TypFilter = Kunde["typ"] | "alle";

function KundenSeite() {
  const { name: akteur } = useAuth();
  const [kunden, setKunden] = useState<Kunde[]>(KUNDEN);
  const [suche, setSuche] = useState("");
  const [typFilter, setTypFilter] = useState<TypFilter>("alle");
  const [aktiv, setAktiv] = useState<string | null>(KUNDEN[0]?.id ?? null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Kunde | null>(null);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return kunden.filter((k) => {
      if (typFilter !== "alle" && k.typ !== typFilter) return false;
      if (!q) return true;
      return (
        k.name.toLowerCase().includes(q) ||
        k.ansprechpartner.toLowerCase().includes(q) ||
        (k.adresse ?? "").toLowerCase().includes(q)
      );
    });
  }, [kunden, suche, typFilter]);

  const selektiert = kunden.find((k) => k.id === aktiv) ?? gefiltert[0] ?? null;

  const hinweise = useMemo(() => buildHinweise(kunden), [kunden]);

  function speichern(values: Kunde) {
    const istNeu = !kunden.some((k) => k.id === values.id);
    setKunden((prev) =>
      istNeu ? [...prev, values] : prev.map((k) => (k.id === values.id ? values : k)),
    );
    setAktiv(values.id);
    setFormOpen(false);
    setEditTarget(null);
    logActivity({
      bereich: "Kunden",
      entitaet: values.name,
      aktion: istNeu ? "angelegt" : "bearbeitet",
      beschreibung: `Kunde „${values.name}“ wurde ${istNeu ? "angelegt" : "aktualisiert"}.`,
      akteur,
    });
    toast.success(`Kunde ${istNeu ? "angelegt" : "gespeichert"}`);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Kunden</h1>
            <p className="text-sm text-muted-foreground">
              Auftraggeber, Kassen, Verträge, Konditionen und Umsätze.
            </p>
          </div>
        </div>
        <Button
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Kunde anlegen
        </Button>
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
                placeholder="Kunde suchen…"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typFilter} onValueChange={(v) => setTypFilter(v as TypFilter)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Typen</SelectItem>
                {KUNDEN_TYPEN.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-1">
            {gefiltert.map((k) => (
              <button
                key={k.id}
                onClick={() => setAktiv(k.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  selektiert?.id === k.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-transparent hover:bg-muted",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{k.name}</span>
                  {k.offeneRechnungen > 0 && (
                    <Badge
                      variant="outline"
                      className="border-warning/30 bg-warning/10 text-warning text-[10px]"
                    >
                      {k.offeneRechnungen} offen
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{k.typ}</p>
              </button>
            ))}
            {gefiltert.length === 0 && (
              <p className="px-1 py-4 text-sm text-muted-foreground">Keine Treffer.</p>
            )}
          </CardContent>
        </Card>

        {selektiert && (
          <KundeDetail
            kunde={selektiert}
            onEdit={() => {
              setEditTarget(selektiert);
              setFormOpen(true);
            }}
          />
        )}
      </div>

      <KundeForm
        open={formOpen}
        target={editTarget}
        existing={kunden}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSave={speichern}
      />
    </div>
  );
}

function buildHinweise(kunden: Kunde[]): string[] {
  const out: string[] = [];
  const offen = kunden.filter((k) => k.offeneRechnungen > 0);
  if (offen.length > 0) {
    const summe = offen.reduce((s, k) => s + k.offeneRechnungen, 0);
    out.push(
      `${offen.length} Kunde(n) mit insgesamt ${summe} offenen Rechnungen – Zahlungseingang prüfen.`,
    );
  }
  const ohneVertrag = kunden.filter((k) => k.vertragsstatus === "Kein Vertrag");
  if (ohneVertrag.length > 0)
    out.push(
      `${ohneVertrag.length} Kunde(n) ohne Rahmen-/Einzelvertrag – Vertragsabschluss empfohlen.`,
    );
  const topUmsatz = [...kunden].sort((a, b) => (b.umsatzJahr ?? 0) - (a.umsatzJahr ?? 0))[0];
  if (topUmsatz?.umsatzJahr)
    out.push(
      `Umsatzstärkster Kunde: „${topUmsatz.name}“ mit ${EUR(topUmsatz.umsatzJahr)} pro Jahr.`,
    );
  if (out.length === 0) out.push("Alle Kunden sind vollständig erfasst, keine offenen Rechnungen.");
  return out.slice(0, 4);
}

function KundeDetail({ kunde, onEdit }: { kunde: Kunde; onEdit: () => void }) {
  const rechnungen = INITIAL_RECHNUNGEN.filter(
    (r) => r.kundeId === kunde.id || r.kunde === kunde.name,
  );
  const transporte = INITIAL_AUFTRAEGE.filter((a) => a.kostentraeger === kunde.name);
  const offenerBetrag = rechnungen
    .filter((r) => r.status !== "bezahlt")
    .reduce((s, r) => s + r.betrag, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              {kunde.name}
              <Badge variant="secondary" className="text-[11px]">
                {kunde.typ}
              </Badge>
            </span>
            <Button variant="outline" size="sm" onClick={onEdit}>
              Bearbeiten
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Zeile icon={User} label="Ansprechpartner" value={kunde.ansprechpartner} />
            <Zeile icon={Phone} label="Telefon" value={kunde.telefon} />
            {kunde.email && <Zeile icon={Mail} label="E-Mail" value={kunde.email} />}
            {kunde.adresse && <Zeile icon={MapPin} label="Adresse" value={kunde.adresse} />}
            {kunde.vertragsstatus && (
              <Zeile icon={FileText} label="Vertrag" value={kunde.vertragsstatus} />
            )}
            {typeof kunde.zahlungszielTage === "number" && (
              <Zeile
                icon={CreditCard}
                label="Zahlungsziel"
                value={`${kunde.zahlungszielTage} Tage`}
              />
            )}
            {typeof kunde.kreditlimit === "number" && (
              <Zeile icon={Euro} label="Kreditlimit" value={EUR(kunde.kreditlimit)} />
            )}
            {typeof kunde.umsatzJahr === "number" && (
              <Zeile icon={Euro} label="Jahresumsatz" value={EUR(kunde.umsatzJahr)} />
            )}
          </div>
          {kunde.konditionen && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Konditionen</p>
              <p className="text-sm">{kunde.konditionen}</p>
            </div>
          )}
          {kunde.notiz && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Notiz</p>
              <p className="text-sm">{kunde.notiz}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4" /> Rechnungen ({rechnungen.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {offenerBetrag > 0 && (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                Offener Betrag: <strong>{EUR(offenerBetrag)}</strong>
              </p>
            )}
            {rechnungen.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine Rechnungen.</p>
            )}
            {rechnungen.map((r) => {
              const meta = RECHNUNG_STATUS_META[r.status];
              return (
                <div key={r.id} className="rounded-xl border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{r.nummer}</span>
                    <Badge variant="outline" className={cn("text-[10px]", meta.badge)}>
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{EUR(r.betrag)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" /> Transporte ({transporte.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {transporte.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine Transporte.</p>
            )}
            {transporte.map((a) => (
              <div key={a.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{a.nummer}</span>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", STATUS_META[a.status].badge)}
                  >
                    {STATUS_META[a.status].label}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {a.patient} · {formatTermin(a.termin)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Zeile({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
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

function KundeForm({
  open,
  target,
  existing,
  onClose,
  onSave,
}: {
  open: boolean;
  target: Kunde | null;
  existing: Kunde[];
  onClose: () => void;
  onSave: (k: Kunde) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{target ? "Kunde bearbeiten" : "Kunde anlegen"}</DialogTitle>
          <DialogDescription>
            Stammdaten, Vertrag und Konditionen für Abrechnung und GHASI AI.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <KundeFelder target={target} existing={existing} onClose={onClose} onSave={onSave} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function KundeFelder({
  target,
  existing,
  onClose,
  onSave,
}: {
  target: Kunde | null;
  existing: Kunde[];
  onClose: () => void;
  onSave: (k: Kunde) => void;
}) {
  const [name, setName] = useState(target?.name ?? "");
  const [typ, setTyp] = useState<Kunde["typ"]>(target?.typ ?? "Krankenkasse");
  const [ansprechpartner, setAnsprechpartner] = useState(target?.ansprechpartner ?? "");
  const [telefon, setTelefon] = useState(target?.telefon ?? "");
  const [email, setEmail] = useState(target?.email ?? "");
  const [adr, setAdr] = useState<AdresseStruktur>(() => parseAdresse(target?.adresse ?? ""));
  const [vertragsstatus, setVertragsstatus] = useState<NonNullable<Kunde["vertragsstatus"]>>(
    target?.vertragsstatus ?? "Rahmenvertrag",
  );
  const [konditionen, setKonditionen] = useState(target?.konditionen ?? "");
  const [zahlungsziel, setZahlungsziel] = useState(
    typeof target?.zahlungszielTage === "number" ? String(target.zahlungszielTage) : "30",
  );
  const [kreditlimit, setKreditlimit] = useState(
    typeof target?.kreditlimit === "number" ? String(target.kreditlimit) : "",
  );
  const [umsatzJahr, setUmsatzJahr] = useState(
    typeof target?.umsatzJahr === "number" ? String(target.umsatzJahr) : "",
  );
  const [notiz, setNotiz] = useState(target?.notiz ?? "");
  const [aktiv, setAktiv] = useState(target?.aktiv ?? true);

  function submit() {
    if (!name.trim()) {
      toast.error("Name ist erforderlich.");
      return;
    }
    onSave({
      id: target?.id ?? nextStammId("k", existing),
      name: name.trim(),
      typ,
      ansprechpartner: ansprechpartner.trim() || "—",
      telefon: telefon.trim(),
      offeneRechnungen: target?.offeneRechnungen ?? 0,
      email: email.trim() || undefined,
      adresse: formatAdresse(adr) || undefined,
      vertragsstatus,
      konditionen: konditionen.trim() || undefined,
      zahlungszielTage: zahlungsziel.trim() ? Number(zahlungsziel) : undefined,
      kreditlimit: kreditlimit.trim() ? Number(kreditlimit) : undefined,
      umsatzJahr: umsatzJahr.trim() ? Number(umsatzJahr) : undefined,
      notiz: notiz.trim() || undefined,
      aktiv,
    });
  }

  return (
    <div className="space-y-4">
      <Feld label="Name *">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Feld>
      <div className="grid gap-4 sm:grid-cols-2">
        <Feld label="Typ">
          <Select value={typ} onValueChange={(v) => setTyp(v as Kunde["typ"])}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KUNDEN_TYPEN.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Feld>
        <Feld label="Vertragsstatus">
          <Select
            value={vertragsstatus}
            onValueChange={(v) => setVertragsstatus(v as NonNullable<Kunde["vertragsstatus"]>)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERTRAGS_STATI.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Feld>
        <Feld label="Ansprechpartner">
          <Input value={ansprechpartner} onChange={(e) => setAnsprechpartner(e.target.value)} />
        </Feld>
        <Feld label="Telefon">
          <Input value={telefon} onChange={(e) => setTelefon(e.target.value)} />
        </Feld>
        <Feld label="E-Mail">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Feld>
        <div className="sm:col-span-2">
          <AddressFields idPrefix="kunde-adresse" label="Adresse" value={adr} onChange={setAdr} />
        </div>

        <Feld label="Zahlungsziel (Tage)">
          <Input
            type="number"
            value={zahlungsziel}
            onChange={(e) => setZahlungsziel(e.target.value)}
          />
        </Feld>
        <Feld label="Kreditlimit (EUR)">
          <Input
            type="number"
            value={kreditlimit}
            onChange={(e) => setKreditlimit(e.target.value)}
          />
        </Feld>
        <Feld label="Jahresumsatz (EUR)">
          <Input type="number" value={umsatzJahr} onChange={(e) => setUmsatzJahr(e.target.value)} />
        </Feld>
      </div>
      <Feld label="Konditionen">
        <Textarea value={konditionen} onChange={(e) => setKonditionen(e.target.value)} rows={2} />
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
