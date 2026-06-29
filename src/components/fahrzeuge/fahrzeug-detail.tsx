import {
  AlertTriangle,
  CalendarClock,
  CreditCard,
  Droplets,
  Euro,
  FileText,
  Fuel,
  Gauge,
  ImageIcon,
  MapPin,
  Pencil,
  Receipt,
  Route as RouteIcon,
  ShieldCheck,
  StickyNote,
  User,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  type Fahrzeug,
  type FahrzeugStatus,
  FAHRZEUG_STATI,
  FAHRZEUG_STATUS_META,
  REIFEN_META,
  AKTION_META,
  fahrzeugWarnungen,
  flottenEmpfehlung,
  formatDatum,
  formatEUR,
  formatKm,
  istAbgelaufen,
  laeuftAb,
  oelwechselFaellig,
  reparaturkostenGesamt,
} from "@/lib/fahrzeuge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface FahrzeugDetailProps {
  fahrzeug: Fahrzeug | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: FahrzeugStatus) => void;
  onEdit: (fahrzeug: Fahrzeug) => void;
}

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

function FristRow({
  icon: Icon,
  label,
  iso,
  tage = 30,
}: {
  icon: LucideIcon;
  label: string;
  iso: string;
  tage?: number;
}) {
  const abgelaufen = istAbgelaufen(iso);
  const bald = laeuftAb(iso, tage);
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm font-medium">{label}</p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          abgelaufen
            ? "border-destructive/30 bg-destructive/10 text-destructive"
            : bald
              ? "border-warning/30 bg-warning/10 text-warning"
              : "border-success/30 bg-success/10 text-success",
        )}
      >
        {iso ? formatDatum(iso) : "—"}
      </Badge>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone = "muted",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "muted" | "success" | "warning" | "info" | "destructive";
}) {
  const toneMap = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning",
    info: "bg-info/15 text-info",
    destructive: "bg-destructive/15 text-destructive",
  } as const;
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div
        className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-lg", toneMap[tone])}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function FahrzeugDetail({
  fahrzeug,
  open,
  onOpenChange,
  onStatusChange,
  onEdit,
}: FahrzeugDetailProps) {
  if (!fahrzeug) return null;

  const status = FAHRZEUG_STATUS_META[fahrzeug.status];
  const warn = fahrzeugWarnungen(fahrzeug);
  const empf = flottenEmpfehlung(fahrzeug);
  const reifen = REIFEN_META[fahrzeug.reifenstatus];
  const repkosten = reparaturkostenGesamt(fahrzeug);
  const tankTone =
    fahrzeug.tankstand <= 20 ? "destructive" : fahrzeug.tankstand <= 40 ? "warning" : "success";
  const aktion = AKTION_META[empf.aktion];

  const empfToneCard = {
    success: "border-success/30 bg-success/5",
    info: "border-info/30 bg-info/5",
    warning: "border-warning/30 bg-warning/5",
    destructive: "border-destructive/30 bg-destructive/5",
  }[empf.tone];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
              <Wrench className="hidden" />
              <span className="text-sm font-bold tracking-tight">{fahrzeug.typ}</span>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card",
                  status.dot,
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl">{fahrzeug.kennzeichen}</SheetTitle>
              <SheetDescription>
                {fahrzeug.nummer} · {fahrzeug.marke} {fahrzeug.modell} · {fahrzeug.baujahr}
              </SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("gap-1", status.badge)}>
              <status.icon className="h-3 w-3" />
              {status.label}
            </Badge>
            {fahrzeug.rollstuhlGeeignet && (
              <Badge variant="outline" className="border-info/30 bg-info/10 text-info">
                Rollstuhl
              </Badge>
            )}
            {fahrzeug.liegendGeeignet && (
              <Badge variant="outline" className="border-info/30 bg-info/10 text-info">
                Liegend
              </Badge>
            )}
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              {fahrzeug.sitzplaetze} Sitze
            </Badge>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* GHASI AI recommendation */}
          <div className={cn("rounded-xl border p-3", empfToneCard)}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("gap-1", aktion.badge)}>
                {aktion.label}
              </Badge>
              <span className="text-xs font-medium text-muted-foreground">GHASI AI</span>
            </div>
            <p className="mt-2 text-sm">{empf.text}</p>
          </div>

          {/* Status switch */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status setzen
            </p>
            <Select
              value={fahrzeug.status}
              onValueChange={(v) => onStatusChange(fahrzeug.id, v as FahrzeugStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAHRZEUG_STATI.map((s) => (
                  <SelectItem key={s} value={s}>
                    {FAHRZEUG_STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fuel level */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Fuel className="h-3.5 w-3.5" /> Tankstand
              </p>
              <span
                className={cn("text-sm font-bold tabular-nums", warn.tank && "text-destructive")}
              >
                {fahrzeug.tankstand}% · {fahrzeug.reichweite} km
              </span>
            </div>
            <Progress value={fahrzeug.tankstand} />
            {warn.tank && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Niedriger Tankstand – betanken empfohlen.
              </p>
            )}
          </div>

          {/* Costs & profit */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Kosten & Erlöse
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Metric
                icon={Euro}
                label="Umsatz heute"
                value={formatEUR(fahrzeug.tagesumsatz)}
                tone="success"
              />
              <Metric
                icon={Gauge}
                label="Gewinn heute"
                value={formatEUR(fahrzeug.tagesgewinn)}
                tone="success"
              />
              <Metric
                icon={RouteIcon}
                label="€ / km"
                value={fahrzeug.kostenProKm.toFixed(2)}
                tone="info"
              />
              <Metric
                icon={Euro}
                label="Umsatz Monat"
                value={formatEUR(fahrzeug.monatsumsatz)}
                tone="success"
              />
              <Metric
                icon={Gauge}
                label="Gewinn Monat"
                value={formatEUR(fahrzeug.monatsgewinn)}
                tone="success"
              />
              <Metric
                icon={Receipt}
                label="Reparaturen"
                value={formatEUR(repkosten)}
                tone={repkosten > 5000 ? "destructive" : "muted"}
              />
            </div>
          </div>

          {/* Live GPS */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Live-GPS
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-gradient-surface p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{fahrzeug.standort}</p>
                <p className="text-xs text-muted-foreground">
                  {fahrzeug.gps.lat.toFixed(3)}, {fahrzeug.gps.lng.toFixed(3)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Vehicle data */}
          <div className="space-y-4">
            <InfoRow
              icon={User}
              label="Aktueller Fahrer"
              value={fahrzeug.fahrer ?? "Nicht zugeordnet"}
            />
            <InfoRow
              icon={RouteIcon}
              label="Kilometerstand"
              value={formatKm(fahrzeug.kilometerstand)}
            />
            <InfoRow
              icon={Fuel}
              label="Kraftstoff"
              value={`${fahrzeug.kraftstoff} · Ø ${fahrzeug.verbrauch}`}
            />
          </div>

          <Separator />

          {/* Maintenance */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Wartung & Fristen
            </p>
            <FristRow icon={ShieldCheck} label="TÜV / HU" iso={fahrzeug.tuevBis} tage={45} />
            <FristRow icon={CalendarClock} label="Nächste Wartung" iso={fahrzeug.naechsteWartung} />
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Droplets className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium">
                  Ölwechsel bei {formatKm(fahrzeug.oelwechselBei)}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  oelwechselFaellig(fahrzeug)
                    ? "border-warning/30 bg-warning/10 text-warning"
                    : "border-success/30 bg-success/10 text-success",
                )}
              >
                in{" "}
                {Math.max(0, fahrzeug.oelwechselBei - fahrzeug.kilometerstand).toLocaleString(
                  "de-DE",
                )}{" "}
                km
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Gauge className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium">Reifenstatus</p>
              </div>
              <Badge variant="outline" className={reifen.badge}>
                {reifen.label}
              </Badge>
            </div>
          </div>

          {/* Repairs */}
          {fahrzeug.reparaturen.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Reparaturen
              </p>
              {fahrzeug.reparaturen.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.beschreibung}</p>
                    <p className="text-xs text-muted-foreground">{formatDatum(r.datum)}</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatEUR(r.kosten)}</span>
                </div>
              ))}
            </div>
          )}

          <Separator />

          {/* Insurance & leasing */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Versicherung & Leasing
            </p>
            <InfoRow icon={ShieldCheck} label="Versicherung" value={fahrzeug.versicherung || "—"} />
            <FristRow
              icon={ShieldCheck}
              label="Versicherung bis"
              iso={fahrzeug.versicherungBis}
              tage={45}
            />
            {fahrzeug.leasingrate > 0 ? (
              <>
                <InfoRow
                  icon={CreditCard}
                  label="Leasingrate"
                  value={`${formatEUR(fahrzeug.leasingrate)} / Monat`}
                />
                <FristRow
                  icon={CalendarClock}
                  label="Leasingende"
                  iso={fahrzeug.leasingEnde}
                  tage={60}
                />
              </>
            ) : (
              <InfoRow icon={CreditCard} label="Leasing" value="Kein Leasing (Eigentum)" />
            )}
          </div>

          {/* Documents & photos */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dokumente & Fotos
            </p>
            {fahrzeug.dokumente.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {fahrzeug.dokumente.map((d) => (
                  <Badge
                    key={d}
                    variant="outline"
                    className="gap-1 border-border bg-muted text-muted-foreground"
                  >
                    <FileText className="h-3 w-3" />
                    {d}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Dokumente hinterlegt.</p>
            )}
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/70 px-3 py-3 text-sm text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              {fahrzeug.fotos.length > 0
                ? `${fahrzeug.fotos.length} Foto(s)`
                : "Keine Fotos hinterlegt"}
            </div>
          </div>

          {/* Notes */}
          {fahrzeug.notizen && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notizen
              </p>
              <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-3">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm">{fahrzeug.notizen}</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-auto">
          <Button variant="outline" className="w-full gap-2" onClick={() => onEdit(fahrzeug)}>
            <Pencil className="h-4 w-4" />
            Fahrzeug bearbeiten
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
