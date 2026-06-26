import {
  Award,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Euro,
  Gauge,
  Heart,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plane,
  Route as RouteIcon,
  ShieldCheck,
  Star,
  ThumbsDown,
  ThumbsUp,
  Thermometer,
  Truck,
  type LucideIcon,
} from "lucide-react";

import {
  type Fahrer,
  type FahrerStatus,
  FAHRER_STATI,
  FAHRER_STATUS_META,
  formatDatum,
  formatEUR,
  initials,
  istAbgelaufen,
  laeuftAb,
} from "@/lib/fahrer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  INITIAL_AUFTRAEGE,
  effektiveVerordnung,
  verordnungFehlt,
} from "@/lib/auftraege";
import { MedizinBadges, fahrzeugMismatch } from "@/components/auftraege/medizin-details";
import { AlertTriangle } from "lucide-react";

interface FahrerDetailProps {
  fahrer: Fahrer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: FahrerStatus) => void;
  onEdit: (fahrer: Fahrer) => void;
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
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

function NachweisRow({
  icon: Icon,
  label,
  iso,
  info,
}: {
  icon: LucideIcon;
  label: string;
  iso: string;
  info?: string;
}) {
  const abgelaufen = iso ? istAbgelaufen(iso) : false;
  const bald = iso ? laeuftAb(iso) : false;
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          {info && <p className="text-xs text-muted-foreground">{info}</p>}
        </div>
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
        {iso ? `bis ${formatDatum(iso)}` : "—"}
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
  tone?: "muted" | "success" | "warning" | "info";
}) {
  const toneMap = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning",
    info: "bg-info/15 text-info",
  } as const;
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className={cn("mb-2 flex h-8 w-8 items-center justify-center rounded-lg", toneMap[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function FahrerDetail({
  fahrer,
  open,
  onOpenChange,
  onStatusChange,
  onEdit,
}: FahrerDetailProps) {
  if (!fahrer) return null;

  const status = FAHRER_STATUS_META[fahrer.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-14 w-14">
                {fahrer.foto && <AvatarImage src={fahrer.foto} alt={fahrer.name} />}
                <AvatarFallback className="bg-gradient-primary text-base font-semibold text-primary-foreground">
                  {initials(fahrer.name)}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card",
                  status.dot,
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-xl">{fahrer.name}</SheetTitle>
              <SheetDescription>
                {fahrer.nummer} · {fahrer.vertragsart}
              </SheetDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("gap-1", status.badge)}>
              <status.icon className="h-3 w-3" />
              {status.label}
            </Badge>
            <Badge variant="outline" className="gap-1 border-warning/30 bg-warning/10 text-warning">
              <Star className="h-3 w-3 fill-current" />
              {fahrer.bewertung.toFixed(1)}
            </Badge>
          </div>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Live status switch */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Live-Status setzen
            </p>
            <Select
              value={fahrer.status}
              onValueChange={(v) => onStatusChange(fahrer.id, v as FahrerStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAHRER_STATI.map((s) => (
                  <SelectItem key={s} value={s}>
                    {FAHRER_STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Today's performance */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Heute
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Metric icon={RouteIcon} label="Kilometer" value={`${fahrer.kmHeute} km`} tone="info" />
              <Metric icon={Euro} label="Umsatz" value={formatEUR(fahrer.umsatzHeute)} tone="success" />
              <Metric icon={Gauge} label="Gewinn" value={formatEUR(fahrer.gewinnHeute)} tone="success" />
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
                <p className="truncate text-sm font-medium">{fahrer.standort}</p>
                <p className="text-xs text-muted-foreground">
                  {fahrer.gps.lat.toFixed(3)}, {fahrer.gps.lng.toFixed(3)}
                  {fahrer.fahrzeug ? ` · ${fahrer.fahrzeug}` : ""}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Fahrer-App: heutige Touren mit medizinischen Details */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Meine Touren (Fahrer-App)
            </p>
            {(() => {
              const touren = INITIAL_AUFTRAEGE.filter(
                (a) => a.fahrer === fahrer.name && a.status !== "storniert",
              );
              if (touren.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground">
                    Aktuell keine zugewiesenen Touren.
                  </p>
                );
              }
              return touren.map((a) => {
                const fehlt = verordnungFehlt(effektiveVerordnung(a));
                const mismatch = fahrzeugMismatch(a);
                return (
                  <div key={a.id} className="rounded-xl border border-border/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{a.patient}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {a.nummer}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.abholort} → {a.zielort}
                    </p>
                    <MedizinBadges auftrag={a} className="mt-2" />
                    {fehlt && (
                      <p className="mt-2 flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Verordnung fehlt – nicht ohne Verordnung starten.
                      </p>
                    )}
                    {mismatch && (
                      <p className="mt-1 flex items-center gap-1 rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Fahrzeugtyp passt nicht zur Mobilität.
                      </p>
                    )}
                    {a.medizinischeNotiz && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Medizinisch: {a.medizinischeNotiz}
                      </p>
                    )}
                  </div>
                );
              });
            })()}
          </div>

          <Separator />



          {/* Contact */}
          <div className="space-y-4">
            <InfoRow icon={Phone} label="Telefon" value={fahrer.telefon || "—"} />
            <InfoRow icon={Mail} label="E-Mail" value={fahrer.email || "—"} />
            <InfoRow icon={MapPin} label="Adresse" value={fahrer.adresse || "—"} />
            <InfoRow icon={Truck} label="Verfügbares Fahrzeug" value={fahrer.fahrzeug ?? "Keins"} />
            <InfoRow icon={Clock} label="Arbeitszeiten" value={fahrer.arbeitszeiten} />
            <InfoRow icon={CalendarDays} label="Schichtplan heute" value={fahrer.schicht} />
            <InfoRow icon={CreditCard} label="Arbeitsvertrag" value={fahrer.vertragsart} />
          </div>

          <Separator />

          {/* Nachweise */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Nachweise & Fristen
            </p>
            <NachweisRow
              icon={CreditCard}
              label="Führerschein"
              iso={fahrer.fuehrerschein.gueltigBis}
              info={fahrer.fuehrerschein.info}
            />
            <NachweisRow icon={ShieldCheck} label="P-Schein" iso={fahrer.pSchein.gueltigBis} />
            <NachweisRow icon={Heart} label="Erste-Hilfe-Nachweis" iso={fahrer.ersteHilfe.gueltigBis} />
          </div>

          <Separator />

          {/* Performance & HR */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Leistung & Personal
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Metric icon={CheckCircle2} label="Pünktlichkeit" value={`${fahrer.puenktlichkeit}%`} tone="success" />
              <Metric icon={Award} label="Überstunden" value={`${fahrer.ueberstunden} h`} tone="warning" />
              <Metric icon={Star} label="Bewertung" value={fahrer.bewertung.toFixed(1)} tone="info" />
              <Metric icon={ThumbsUp} label="Lob" value={`${fahrer.lob}`} tone="success" />
              <Metric icon={ThumbsDown} label="Beschwerden" value={`${fahrer.beschwerden}`} tone={fahrer.beschwerden > 0 ? "warning" : "muted"} />
              <Metric icon={Plane} label="Urlaub übrig" value={`${fahrer.urlaubstage} T`} tone="info" />
              <Metric icon={Thermometer} label="Krank (Jahr)" value={`${fahrer.krankheitstage} T`} tone={fahrer.krankheitstage > 5 ? "warning" : "muted"} />
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <Button variant="outline" className="w-full gap-2" onClick={() => onEdit(fahrer)}>
            <Pencil className="h-4 w-4" />
            Fahrer bearbeiten
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
