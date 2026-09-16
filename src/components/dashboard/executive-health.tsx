import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { HeartPulse, Wallet, Activity, Truck, Users, Wrench, ArrowRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { computeKpis, computeBusinessHealth } from "@/lib/ai-brain";
import { computeFinanzKpis, EUR } from "@/lib/finance";
import { useOrders } from "@/lib/orders-store";
import { useDrivers } from "@/lib/drivers-store";
import { useInvoices } from "@/lib/invoices-store";
import { useVehicles } from "@/lib/vehicles-store";

interface HealthMetric {
  label: string;
  wert: number;
  icon: typeof Activity;
  to: string;
}

function tone(wert: number): string {
  if (wert >= 80) return "text-success";
  if (wert >= 60) return "text-info";
  if (wert >= 45) return "text-warning";
  return "text-destructive";
}

/** Executive health overview: overall score plus per-domain sub-scores and cash flow. */
export function ExecutiveHealth() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const ordersQ = useOrders();
  const driversQ = useDrivers();
  const invoicesQ = useInvoices();
  const vehiclesQ = useVehicles();
  // Dieses Widget rief bisher keinen Hydrations-Hook auf und las computeKpis()
  // damit sofort aus den Legacy-Spiegeln, die bis zur ersten Hydration mit
  // festen Demo-Fuhrpark-Daten vorbelegt sind – daher konnte hier kurz ein
  // erfundener "Kritisch"-Score statt des echten Health Scores aufblitzen.
  const bereit =
    ordersQ.data !== undefined &&
    driversQ.data !== undefined &&
    invoicesQ.data !== undefined &&
    vehiclesQ.data !== undefined;

  const kpis = computeKpis({
    auftraege: ordersQ.data ?? [],
    fahrer: driversQ.data ?? [],
    fahrzeuge: vehiclesQ.data ?? [],
    rechnungen: invoicesQ.data ?? [],
  });
  const health = computeBusinessHealth(kpis);
  const finanz = computeFinanzKpis(invoicesQ.data ?? [], {
    fahrer: driversQ.data ?? [],
    fahrzeuge: vehiclesQ.data ?? [],
    auftraege: ordersQ.data ?? [],
    rechnungen: invoicesQ.data ?? [],
  });

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  const metriken: HealthMetric[] = [
    {
      label: "Finanzen",
      wert: clamp((finanz.margeProzent / 30) * 100),
      icon: Wallet,
      to: "/buchhaltung",
    },
    {
      label: "Betrieb",
      wert: clamp(
        ((kpis.flottenauslastung + kpis.fahrerauslastung) / 2) * 0.6 +
          kpis.durchschnittPuenktlichkeit * 0.4,
      ),
      icon: Activity,
      to: "/control-center",
    },
    {
      label: "Flotte",
      wert: clamp(kpis.flottenauslastung - kpis.kritischeAlarme * 6),
      icon: Truck,
      to: "/fahrzeuge",
    },
    {
      label: "Fahrer",
      wert: clamp(kpis.fahrerauslastung * 0.6 + (kpis.durchschnittBewertung / 5) * 40),
      icon: Users,
      to: "/fahrer",
    },
    {
      label: "Wartung",
      wert: clamp(100 - kpis.wartungOffen * 12 - kpis.kritischeAlarme * 8),
      icon: Wrench,
      to: "/wartung",
    },
  ];

  if (!bereit) {
    return (
      <Card className="border-border/70 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <HeartPulse className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Business Health</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-40 lg:col-span-1" />
          <Skeleton className="h-40 lg:col-span-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HeartPulse className="h-4 w-4" />
          </div>
          <CardTitle className="text-base">Business Health</CardTitle>
        </div>
        <Badge variant="secondary" className="capitalize">
          {health.stufe}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-3">
        {/* Overall score */}
        <div className="flex flex-col justify-center rounded-2xl bg-gradient-primary p-5 text-primary-foreground">
          <p className="text-sm text-primary-foreground/80">Business Health Score</p>
          <p className="mt-1 text-5xl font-bold tabular-nums">{health.score}</p>
          <p className="text-sm text-primary-foreground/80">von 100</p>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-primary-foreground/90">
              <span>Cashflow (Monat)</span>
              <span className="font-semibold">{mounted ? EUR(finanz.gewinnMonat) : "—"}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-primary-foreground/90">
              <span>Offene Posten</span>
              <span className="font-semibold">{mounted ? EUR(finanz.offenePosten) : "—"}</span>
            </div>
          </div>
        </div>

        {/* Sub scores */}
        <div className="space-y-3.5 lg:col-span-2">
          {metriken.map((m) => (
            <Link key={m.label} to={m.to} className="block">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <m.icon className="h-4 w-4" />
                  {m.label}
                </span>
                <span className={cn("font-semibold tabular-nums", tone(m.wert))}>{m.wert}</span>
              </div>
              <Progress value={m.wert} className="h-2" />
            </Link>
          ))}
          <Link
            to="/control-center"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Zum Control Center <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
