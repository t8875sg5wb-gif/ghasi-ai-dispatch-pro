// KI-Fahrer-/Fahrzeug-Vorschlag für einen unzugewiesenen Auftrag.
// Sicherheit: zeigt nur Empfehlungen – Zuweisung erst nach manueller Bestätigung.
import { useMemo } from "react";
import { Bot, Check, Clock, Gauge, Truck, User } from "lucide-react";

import { type Auftrag, INITIAL_AUFTRAEGE } from "@/lib/auftraege";
import { INITIAL_FAHRER } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";
import { empfehleFuerAuftrag, type FahrerVorschlag } from "@/lib/driver-suggestion";
import { fehlendeFelder } from "@/lib/order-urgency";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DriverSuggestionProps {
  auftrag: Auftrag;
  /** Manuelle Bestätigung der Zuweisung. */
  onConfirm: (fahrer: string, fahrzeug: string | null) => void;
  disabled?: boolean;
}

function VorschlagZeile({
  v,
  primary,
  onConfirm,
  disabled,
}: {
  v: FahrerVorschlag;
  primary?: boolean;
  onConfirm: (fahrer: string, fahrzeug: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        primary ? "border-primary/40 bg-primary/5" : "border-border/70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{v.fahrer.name}</span>
            {primary && (
              <Badge variant="outline" className="h-5 border-primary/30 bg-primary/10 px-1.5 text-[10px] text-primary">
                Empfohlen
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              {v.fahrzeugKennzeichen ?? "kein Fahrzeug"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              ETA {v.etaMin} Min
            </span>
            <span className="flex items-center gap-1">
              <Gauge className="h-3 w-3" />
              {v.konfidenz}% Konfidenz
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant={primary ? "default" : "outline"}
          className="shrink-0 gap-1.5"
          disabled={disabled}
          onClick={() => onConfirm(v.fahrer.name, v.fahrzeugKennzeichen)}
        >
          <Check className="h-3.5 w-3.5" />
          Zuweisen
        </Button>
      </div>
      {primary && (
        <p className="mt-2 text-xs text-muted-foreground">{v.begruendung}</p>
      )}
    </div>
  );
}

export function DriverSuggestion({ auftrag, onConfirm, disabled }: DriverSuggestionProps) {
  const fehlt = fehlendeFelder(auftrag);
  const { empfehlung, alternativen } = useMemo(
    () =>
      empfehleFuerAuftrag(
        auftrag,
        INITIAL_FAHRER,
        INITIAL_FAHRZEUGE,
        INITIAL_AUFTRAEGE,
      ),
    [auftrag],
  );

  if (fehlt.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">GHASI AI – Zuweisungsvorschlag</p>
          <p className="text-xs text-muted-foreground">
            Fehlt: {fehlt.join(" & ")} · Bestätigung erforderlich
          </p>
        </div>
      </div>

      {empfehlung ? (
        <div className="space-y-2">
          <VorschlagZeile v={empfehlung} primary onConfirm={onConfirm} disabled={disabled} />
          {alternativen.length > 0 && (
            <>
              <p className="pt-1 text-xs font-medium text-muted-foreground">Alternativen</p>
              {alternativen.map((v) => (
                <VorschlagZeile
                  key={v.fahrer.id}
                  v={v}
                  onConfirm={onConfirm}
                  disabled={disabled}
                />
              ))}
            </>
          )}
        </div>
      ) : (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Aktuell ist kein einsetzbarer Fahrer verfügbar. Bitte Verfügbarkeiten prüfen.
        </p>
      )}
    </div>
  );
}
