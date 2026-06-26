// ============================================================
// GHASI AI – Live Alarm-Center
// Vereint die bestehende Konflikterkennung (Dispatch) mit den
// Flotten-Alerts (Live-GPS) zu einem einzigen Alarm-Board mit
// Schweregrad, Grund, betroffenem Transport, Lösungsvorschlag
// und Ein-Klick-Navigation zum Transport.
// ============================================================
import { useMemo } from "react";
import { AlertTriangle, ArrowRight, ShieldCheck, Siren } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

import type { DispatchTransport, Konflikt } from "@/lib/dispatch";
import { KONFLIKT_LOESUNG } from "@/lib/dispatch-board";
import { ALERT_SCHWERE_META, computeFleetAlerts, type AlertSchwere } from "@/lib/fleet-live";

type Stufe = "kritisch" | "hoch" | "mittel";

interface AlarmEintrag {
  id: string;
  stufe: Stufe;
  titel: string;
  grund: string;
  loesung: string;
  transportId?: string;
  transportNummer?: string;
}

const STUFE_META: Record<Stufe, { label: string; badge: string; rang: number }> = {
  kritisch: { label: "Kritisch", badge: ALERT_SCHWERE_META.kritisch.badge, rang: 0 },
  hoch: { label: "Hoch", badge: ALERT_SCHWERE_META.hoch.badge, rang: 1 },
  mittel: { label: "Mittel", badge: ALERT_SCHWERE_META.mittel.badge, rang: 2 },
};

function fleetSchwereZuStufe(s: AlertSchwere): Stufe {
  return s;
}

export function AlarmCenter({
  konflikte,
  transporte,
  onOpen,
}: {
  konflikte: Konflikt[];
  transporte: DispatchTransport[];
  onOpen: (id: string) => void;
}) {
  const alarme = useMemo<AlarmEintrag[]>(() => {
    const nummerZuId = new Map<string, string>();
    for (const t of transporte) nummerZuId.set(t.nummer, t.id);

    const ausKonflikt: AlarmEintrag[] = konflikte.map((k) => ({
      id: `k-${k.id}`,
      stufe: k.schwere === "kritisch" ? "kritisch" : "hoch",
      titel: k.text.split(":")[0]?.slice(0, 80) ?? k.text.slice(0, 80),
      grund: k.text,
      loesung: KONFLIKT_LOESUNG[k.typ],
      transportId: k.transportId,
    }));

    const ausFlotte: AlarmEintrag[] = computeFleetAlerts()
      .filter((a) =>
        ["fahrzeug_offline", "fahrer_offline", "gps_verloren", "tank_niedrig"].includes(a.typ),
      )
      .map((a) => ({
        id: `f-${a.kennzeichen}-${a.typ}`,
        stufe: fleetSchwereZuStufe(a.schwere),
        titel: a.titel,
        grund: a.details,
        loesung:
          a.typ === "tank_niedrig"
            ? "Fahrzeug vor dem nächsten Einsatz betanken."
            : a.typ === "gps_verloren"
              ? "GPS-Verbindung prüfen, Fahrer telefonisch kontaktieren."
              : "Ersatzfahrzeug bzw. verfügbaren Fahrer einplanen.",
        transportId: a.transportNummer ? nummerZuId.get(a.transportNummer) : undefined,
        transportNummer: a.transportNummer,
      }));

    return [...ausKonflikt, ...ausFlotte].sort(
      (a, b) => STUFE_META[a.stufe].rang - STUFE_META[b.stufe].rang,
    );
  }, [konflikte, transporte]);

  const kritisch = alarme.filter((a) => a.stufe === "kritisch").length;

  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <Siren className="h-4 w-4" />
        </div>
        <CardTitle className="text-base">
          Live Alarm-Center
          {alarme.length > 0 && (
            <Badge className="ml-2 border-destructive/30 bg-destructive/10 text-destructive">
              {alarme.length}
            </Badge>
          )}
        </CardTitle>
        {kritisch > 0 && (
          <span className="ml-auto text-xs font-medium text-destructive">{kritisch} kritisch</span>
        )}
      </CardHeader>
      <CardContent>
        {alarme.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-sm text-success">
            <ShieldCheck className="h-4 w-4" /> Keine aktiven Alarme – Betrieb läuft stabil.
          </div>
        ) : (
          <ScrollArea className="h-[460px] pr-3">
            <div className="space-y-2">
              {alarme.map((a) => {
                const meta = STUFE_META[a.stufe];
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "rounded-xl border p-3",
                      a.stufe === "kritisch"
                        ? "border-destructive/30 bg-destructive/5"
                        : a.stufe === "hoch"
                          ? "border-warning/30 bg-warning/5"
                          : "border-info/30 bg-info/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          a.stufe === "kritisch"
                            ? "text-destructive"
                            : a.stufe === "hoch"
                              ? "text-warning"
                              : "text-info",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{a.titel}</span>
                          <Badge className={cn("ml-auto shrink-0 text-[10px]", meta.badge)}>
                            {meta.label}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs leading-snug text-muted-foreground">{a.grund}</p>
                        <p className="mt-1.5 text-xs leading-snug">
                          <span className="font-medium text-foreground">Lösung: </span>
                          {a.loesung}
                        </p>
                        {a.transportId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 gap-1 text-xs"
                            onClick={() => onOpen(a.transportId!)}
                          >
                            Transport öffnen
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
