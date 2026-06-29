import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarClock,
  Droplets,
  Fuel,
  Gauge,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import {
  type Fahrzeug,
  INITIAL_FAHRZEUGE,
  AKTION_META,
  REIFEN_META,
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
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/wartung")({
  head: () => ({
    meta: [
      { title: "Wartung – GHASI AI" },
      {
        name: "description",
        content:
          "Wartungsübersicht: Ölwechsel, TÜV, Reifen, Reparaturen und nächste Wartung mit KI-Warnungen.",
      },
    ],
  }),
  component: WartungPage,
});

function fristTone(iso: string, tage = 30) {
  if (istAbgelaufen(iso)) return "border-destructive/30 bg-destructive/10 text-destructive";
  if (laeuftAb(iso, tage)) return "border-warning/30 bg-warning/10 text-warning";
  return "border-success/30 bg-success/10 text-success";
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/70">
      <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <CardContent className="space-y-2 p-3">{children}</CardContent>
    </Card>
  );
}

function Row({ fahrzeug, right }: { fahrzeug: Fahrzeug; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{fahrzeug.kennzeichen}</p>
        <p className="truncate text-xs text-muted-foreground">
          {fahrzeug.typ} · {fahrzeug.marke} {fahrzeug.modell}
        </p>
      </div>
      {right}
    </div>
  );
}

function WartungPage() {
  const fahrzeuge = INITIAL_FAHRZEUGE;

  const oel = useMemo(() => fahrzeuge.filter((f) => oelwechselFaellig(f)), [fahrzeuge]);
  const tuev = useMemo(
    () => [...fahrzeuge].sort((a, b) => (a.tuevBis > b.tuevBis ? 1 : -1)),
    [fahrzeuge],
  );
  const wartung = useMemo(
    () => [...fahrzeuge].sort((a, b) => (a.naechsteWartung > b.naechsteWartung ? 1 : -1)),
    [fahrzeuge],
  );
  const reifen = useMemo(() => fahrzeuge.filter((f) => f.reifenstatus !== "gut"), [fahrzeuge]);
  const reparaturen = useMemo(
    () =>
      [...fahrzeuge]
        .filter((f) => f.reparaturen.length > 0)
        .sort((a, b) => reparaturkostenGesamt(b) - reparaturkostenGesamt(a)),
    [fahrzeuge],
  );
  const tank = useMemo(() => fahrzeuge.filter((f) => f.tankstand <= 20), [fahrzeuge]);
  const empfehlungen = useMemo(
    () => fahrzeuge.map(flottenEmpfehlung).filter((e) => e.aktion !== "einsetzen"),
    [fahrzeuge],
  );

  const offeneWarnungen = fahrzeuge.filter((f) => fahrzeugWarnungen(f).hatWarnung).length;

  const summary = [
    {
      label: "Wartungswarnungen",
      value: String(offeneWarnungen),
      icon: AlertTriangle,
      tone: "bg-warning/20 text-warning",
    },
    {
      label: "Ölwechsel fällig",
      value: String(oel.length),
      icon: Droplets,
      tone: "bg-info/15 text-info",
    },
    {
      label: "Niedriger Tank",
      value: String(tank.length),
      icon: Fuel,
      tone: "bg-destructive/15 text-destructive",
    },
    {
      label: "Reifen prüfen",
      value: String(reifen.length),
      icon: Gauge,
      tone: "bg-primary/10 text-primary",
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Wartung</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ölwechsel, TÜV, Reifen, Reparaturen und nächste Wartung – flottenweit.
          </p>
        </div>
        <Link
          to="/fahrzeuge"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Wrench className="h-4 w-4" />
          Zu den Fahrzeugen
        </Link>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label} className="border-border/70 p-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                  s.tone,
                )}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold tabular-nums leading-none">{s.value}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </section>

      {/* GHASI AI maintenance advice */}
      <section>
        <Card className="overflow-hidden border-primary/20 shadow-card">
          <div className="flex items-center gap-2 border-b border-border/60 bg-gradient-primary px-4 py-3 text-primary-foreground">
            <Sparkles className="h-4 w-4" />
            <p className="text-sm font-semibold">GHASI AI – Wartungs- & Flottenempfehlungen</p>
          </div>
          <CardContent className="p-4">
            {empfehlungen.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Keine dringenden Maßnahmen. Die Flotte ist in gutem Zustand.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {empfehlungen.map((e) => {
                  const aktion = AKTION_META[e.aktion];
                  return (
                    <div
                      key={e.fahrzeug.id}
                      className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3"
                    >
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{e.fahrzeug.kennzeichen}</p>
                        <Badge variant="outline" className={cn("ml-auto", aktion.badge)}>
                          {aktion.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{e.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Detail sections */}
      <section className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          icon={CalendarClock}
          title="Nächste Wartung"
          subtitle="Geplante Servicetermine"
        >
          {wartung.map((f) => (
            <Row
              key={f.id}
              fahrzeug={f}
              right={
                <Badge variant="outline" className={fristTone(f.naechsteWartung)}>
                  {formatDatum(f.naechsteWartung)}
                </Badge>
              }
            />
          ))}
        </SectionCard>

        <SectionCard icon={ShieldCheck} title="TÜV / HU" subtitle="Hauptuntersuchung fällig">
          {tuev.map((f) => (
            <Row
              key={f.id}
              fahrzeug={f}
              right={
                <Badge variant="outline" className={fristTone(f.tuevBis, 45)}>
                  {formatDatum(f.tuevBis)}
                </Badge>
              }
            />
          ))}
        </SectionCard>

        <SectionCard icon={Droplets} title="Ölwechsel" subtitle="Nach Kilometerstand fällig">
          {oel.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              Kein Ölwechsel in Kürze fällig.
            </p>
          ) : (
            oel.map((f) => (
              <Row
                key={f.id}
                fahrzeug={f}
                right={
                  <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                    in {Math.max(0, f.oelwechselBei - f.kilometerstand).toLocaleString("de-DE")} km
                  </Badge>
                }
              />
            ))
          )}
        </SectionCard>

        <SectionCard icon={Gauge} title="Reifen" subtitle="Reifenzustand prüfen">
          {reifen.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">Alle Reifen in gutem Zustand.</p>
          ) : (
            reifen.map((f) => (
              <Row
                key={f.id}
                fahrzeug={f}
                right={
                  <Badge variant="outline" className={REIFEN_META[f.reifenstatus].badge}>
                    {REIFEN_META[f.reifenstatus].label}
                  </Badge>
                }
              />
            ))
          )}
        </SectionCard>

        <SectionCard icon={Receipt} title="Reparaturen" subtitle="Kosten je Fahrzeug">
          {reparaturen.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">Keine Reparaturen erfasst.</p>
          ) : (
            reparaturen.map((f) => {
              const kosten = reparaturkostenGesamt(f);
              return (
                <Row
                  key={f.id}
                  fahrzeug={f}
                  right={
                    <Badge
                      variant="outline"
                      className={cn(
                        kosten > 5000
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {formatEUR(kosten)} · {f.reparaturen.length}×
                    </Badge>
                  }
                />
              );
            })
          )}
        </SectionCard>

        <SectionCard icon={Fuel} title="Tankstand" subtitle="Fahrzeuge mit niedrigem Tank">
          {tank.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              Alle Fahrzeuge ausreichend betankt.
            </p>
          ) : (
            tank.map((f) => (
              <Row
                key={f.id}
                fahrzeug={f}
                right={
                  <Badge
                    variant="outline"
                    className="border-destructive/30 bg-destructive/10 text-destructive"
                  >
                    {Math.round(f.tankstand)}% · {formatKm(f.reichweite)}
                  </Badge>
                }
              />
            ))
          )}
        </SectionCard>
      </section>
    </div>
  );
}
