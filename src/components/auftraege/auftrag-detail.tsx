import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CreditCard,
  MapPin,
  Phone,
  Pencil,
  Truck,
  User,
} from "lucide-react";

import {
  type Auftrag,
  type AuftragStatus,
  PRIORITAET_META,
  STATUS_META,
  STATUS_PIPELINE,
  STATUS_TRANSITIONS,
  formatTermin,
} from "@/lib/auftraege";
import {
  warnStufe,
  minutenBis,
  formatCountdown,
  fehlendeFelder,
  istUnzugewiesen,
  hatWarnung,
  WARN_META,
} from "@/lib/order-urgency";
import { parseAdresse, formatAdresseMehrzeilig } from "@/lib/address";
import { DriverSuggestion } from "@/components/auftraege/driver-suggestion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { MedizinDetails } from "@/components/auftraege/medizin-details";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface AuftragDetailProps {
  auftrag: Auftrag | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: string, status: AuftragStatus) => void;
  onEdit: (auftrag: Auftrag) => void;
  /** Manuelle Zuweisung von Fahrer/Fahrzeug (nur nach Bestätigung). */
  onAssign?: (id: string, fahrer: string, fahrzeug: string | null) => void;
  /** Darf der aktuelle Nutzer Aufträge bearbeiten (admin/disposition)? */
  canManage?: boolean;
  /** Darf der aktuelle Nutzer den Status ändern (inkl. fahrer)? */
  canChangeStatus?: boolean;
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
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
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

export function AuftragDetail({
  auftrag,
  open,
  onOpenChange,
  onStatusChange,
  onEdit,
  onAssign,
  canManage = true,
  canChangeStatus = true,
}: AuftragDetailProps) {
  if (!auftrag) return null;

  const status = STATUS_META[auftrag.status];
  const prio = PRIORITAET_META[auftrag.prioritaet];
  const transitions = STATUS_TRANSITIONS[auftrag.status];
  const activeIndex = STATUS_PIPELINE.indexOf(auftrag.status);

  const now = Date.now();
  const stufe = warnStufe(auftrag, now);
  const zeigtWarnung = hatWarnung(stufe);
  const unzugewiesen = istUnzugewiesen(auftrag);
  const fehlt = fehlendeFelder(auftrag);
  const abholZeilen = formatAdresseMehrzeilig(auftrag.pickup ?? parseAdresse(auftrag.abholort));
  const zielZeilen = formatAdresseMehrzeilig(auftrag.destination ?? parseAdresse(auftrag.zielort));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("gap-1", status.badge)}>
              <status.icon className="h-3 w-3" />
              {status.label}
            </Badge>
            <Badge variant="outline" className={prio.badge}>
              {prio.label}
            </Badge>
            {zeigtWarnung && (
              <Badge variant="outline" className={cn("gap-1", WARN_META[stufe].badge)}>
                <AlertTriangle className="h-3 w-3" />
                {WARN_META[stufe].label} · {formatCountdown(minutenBis(auftrag, now))}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-xl">{auftrag.patient}</SheetTitle>
          <SheetDescription>
            {auftrag.nummer} · {auftrag.transportart}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Workflow pipeline */}
          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Status-Workflow
            </p>
            <div className="flex items-center justify-between">
              {STATUS_PIPELINE.map((s, i) => {
                const meta = STATUS_META[s];
                const reached = auftrag.status !== "storniert" && i <= activeIndex;
                return (
                  <div key={s} className="flex flex-1 flex-col items-center text-center">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors",
                        reached
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      <meta.icon className="h-4 w-4" />
                    </div>
                    <span
                      className={cn(
                        "mt-1.5 text-[10px] leading-tight",
                        reached ? "font-medium text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {auftrag.status === "storniert" && (
              <p className="mt-3 text-center text-xs font-medium text-destructive">
                Dieser Auftrag wurde storniert.
              </p>
            )}
          </div>

          {/* Status actions */}
          {canChangeStatus && transitions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {transitions.map((next) => {
                const meta = STATUS_META[next];
                const destructive = next === "storniert";
                return (
                  <Button
                    key={next}
                    size="sm"
                    variant={destructive ? "outline" : "default"}
                    className={cn(
                      "gap-1.5",
                      destructive &&
                        "border-destructive/30 text-destructive hover:bg-destructive/10",
                    )}
                    onClick={() => onStatusChange(auftrag.id, next)}
                  >
                    <meta.icon className="h-3.5 w-3.5" />
                    {next === "storniert"
                      ? "Stornieren"
                      : next === "neu"
                        ? "Reaktivieren"
                        : `Auf "${meta.label}" setzen`}
                  </Button>
                );
              })}
            </div>
          )}
          {!canChangeStatus && (
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              Sie haben nur Lesezugriff auf diesen Auftrag.
            </p>
          )}

          {/* KI-Zuweisungsvorschlag bei fehlendem Fahrer/Fahrzeug */}
          {canManage && unzugewiesen && onAssign && (
            <DriverSuggestion
              auftrag={auftrag}
              onConfirm={(fahrer, fahrzeug) => onAssign(auftrag.id, fahrer, fahrzeug)}
            />
          )}

          <Separator />

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Abholort</p>
                {abholZeilen.length > 0 ? (
                  abholZeilen.map((z, i) => (
                    <p key={i} className="text-sm font-medium leading-tight">
                      {z}
                    </p>
                  ))
                ) : (
                  <p className="text-sm font-medium">—</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Zielort</p>
                {zielZeilen.length > 0 ? (
                  zielZeilen.map((z, i) => (
                    <p key={i} className="text-sm font-medium leading-tight">
                      {z}
                    </p>
                  ))
                ) : (
                  <p className="text-sm font-medium">—</p>
                )}
              </div>
            </div>
            <InfoRow icon={Calendar} label="Termin" value={formatTermin(auftrag.termin)} />
            <InfoRow icon={User} label="Fahrer" value={auftrag.fahrer ?? "Nicht zugewiesen"} />
            <InfoRow icon={Truck} label="Fahrzeug" value={auftrag.fahrzeug ?? "Nicht zugewiesen"} />
            <InfoRow icon={CreditCard} label="Kostenträger" value={auftrag.kostentraeger || "—"} />
            <InfoRow
              icon={Phone}
              label="Telefon"
              value={auftrag.telefon?.trim() ? auftrag.telefon : "—"}
            />
            {fehlt.length > 0 && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                Fehlende Zuweisung: {fehlt.join(" & ")}
              </p>
            )}
          </div>

          <Separator />

          <div>
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Medizinische Transportdetails
            </p>
            <MedizinDetails auftrag={auftrag} rolle="dispo" />
          </div>

          {auftrag.notiz && (
            <>
              <Separator />
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notiz
                </p>
                <p className="text-sm text-muted-foreground">{auftrag.notiz}</p>
              </div>
            </>
          )}
        </div>

        {canManage && (
          <div className="mt-auto">
            <Button variant="outline" className="w-full gap-2" onClick={() => onEdit(auftrag)}>
              <Pencil className="h-4 w-4" />
              Auftrag bearbeiten
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
