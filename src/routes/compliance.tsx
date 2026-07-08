import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ClipboardCheck,
  ShieldCheck,
  AlertTriangle,
  ListChecks,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVehicles } from "@/lib/vehicles-store";
import { useDrivers } from "@/lib/drivers-store";
import { useInsurance } from "@/lib/insurance-store";
import { useLeasing } from "@/lib/leasing-store";
import { usePatients } from "@/lib/patients-store";
import { useOrders } from "@/lib/orders-store";
import { useInvoices } from "@/lib/invoices-store";
import { useInsurerContracts } from "@/lib/insurer-contracts-store";
import { useInsurers } from "@/lib/insurers-store";
import { useCompanySettings } from "@/lib/company-settings-store";
import {
  computePflichten,
  computeVollstaendigkeit,
  computeZahlungsUebersicht,
  type PflichtStatus,
} from "@/lib/compliance";
import { computeLohn } from "@/lib/lohn";
import { EUR2 } from "@/lib/finance";

export const Route = createFileRoute("/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance-Cockpit – GHASI AI" },
      {
        name: "description",
        content: "Fristen, Nachweise und Vollständigkeit für Schiene-A-Krankenfahrten.",
      },
    ],
  }),
  component: CompliancePage,
});

const STATUS_META: Record<PflichtStatus, { label: string; badge: string }> = {
  ok: { label: "OK", badge: "border-success/30 bg-success/10 text-success" },
  warnung: { label: "Bald fällig", badge: "border-warning/30 bg-warning/10 text-warning" },
  kritisch: { label: "Kritisch", badge: "border-destructive/30 bg-destructive/10 text-destructive" },
  offen: { label: "Offen", badge: "border-info/30 bg-info/10 text-info" },
  info: { label: "Hinweis", badge: "border-border bg-muted text-muted-foreground" },
};

function CompliancePage() {
  const { data: vehicles } = useVehicles();
  const { data: drivers } = useDrivers();
  const { data: insurance } = useInsurance();
  const { data: leasing } = useLeasing();
  const { data: patients } = usePatients();
  const { data: orders } = useOrders();
  const { data: invoices } = useInvoices();
  const { data: contracts } = useInsurerContracts();
  const { data: insurers } = useInsurers();
  const { data: company } = useCompanySettings();

  const input = useMemo(
    () => ({
      fahrzeuge: vehicles ?? [],
      fahrer: drivers ?? [],
      versicherungen: insurance ?? [],
      leasing: leasing ?? [],
      patienten: patients ?? [],
      auftraege: orders ?? [],
      rechnungen: invoices ?? [],
      vertraege: contracts ?? [],
      kassen: insurers ?? [],
      company,
    }),
    [vehicles, drivers, insurance, leasing, patients, orders, invoices, contracts, insurers, company],
  );

  const pflichten = useMemo(() => computePflichten(input), [input]);
  const luecken = useMemo(() => computeVollstaendigkeit(input), [input]);

  const loehneMonat = useMemo(
    () =>
      (drivers ?? []).reduce(
        (s, d) => s + computeLohn(d.beschaeftigungsart ?? "minijob", d.monatsbrutto ?? 0).agGesamt,
        0,
      ),
    [drivers],
  );
  const zahlungen = useMemo(
    () => computeZahlungsUebersicht(input, loehneMonat),
    [input, loehneMonat],
  );

  const kritisch = pflichten.filter((p) => p.status === "kritisch").length;
  const offen = pflichten.filter((p) => p.status === "offen").length + luecken.length;

  const kategorien = useMemo(() => {
    const map = new Map<string, typeof pflichten>();
    for (const p of pflichten) {
      const list = map.get(p.kategorie) ?? [];
      list.push(p);
      map.set(p.kategorie, list);
    }
    return Array.from(map.entries());
  }, [pflichten]);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Compliance-Cockpit (Schiene A)"
        description="Wiederkehrende Pflichten mit Fristen, Status und Anleitung – nur Schiene-A-relevant (Krankenfahrten ohne medizinische Betreuung). Plus Vollständigkeits-Prüfer „Was fehlt noch?“."
        icon={ClipboardCheck}
        badge="Compliance"
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Kritische Fristen" value={String(kritisch)} icon={AlertTriangle} tone={kritisch > 0 ? "warning" : "success"} />
        <StatCard label="Offene Punkte" value={String(offen)} icon={ListChecks} tone="info" />
        <StatCard label="Ausgaben/Monat" value={EUR2(zahlungen.ausgehendSumme)} icon={TrendingDown} tone="warning" />
        <StatCard label="Offene Forderungen" value={EUR2(zahlungen.eingehendSumme)} icon={TrendingUp} tone="primary" />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {kategorien.map(([kat, list]) => (
          <Card key={kat} className="border-border/70 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4" /> {kat}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {list.map((p) => {
                const meta = STATUS_META[p.status];
                return (
                  <div key={p.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{p.titel}</p>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${meta.badge}`}>
                        {meta.label}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.detail}</p>
                    {p.schritte && (
                      <p className="mt-1 text-[11px] text-muted-foreground/80">→ {p.schritte}</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Vollständigkeit */}
      <Card className="border-border/70 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4" /> Was fehlt noch?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {luecken.length === 0 ? (
            <p className="text-sm text-success">Alle Pflichtangaben vollständig. 🎉</p>
          ) : (
            luecken.map((l, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <div>
                  <span className="text-xs text-muted-foreground">{l.bereich}:</span>{" "}
                  <span className="font-medium">{l.eintrag}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {l.fehlend.map((f) => (
                    <Badge
                      key={f}
                      variant="outline"
                      className="border-warning/30 bg-warning/10 text-[10px] text-warning"
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Zahlungsübersicht */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-warning" /> Anstehende Ausgaben
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {zahlungen.ausgehend.map((p) => (
              <div key={p.titel} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.titel}</span>
                <span className="font-semibold tabular-nums">{EUR2(p.betrag)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-border/60 pt-2 text-sm font-semibold">
              <span>Gesamt/Monat</span>
              <span className="tabular-nums">{EUR2(zahlungen.ausgehendSumme)}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-success" /> Offene Forderungen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {zahlungen.eingehend.map((p) => (
              <div key={p.titel} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{p.titel}</span>
                <span className="font-semibold tabular-nums">{EUR2(p.betrag)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        Betriebsleiter ist erst ab 11+ Fahrzeugen erforderlich. Diese Übersicht ersetzt keine
        rechtliche oder steuerliche Beratung.
      </div>
    </div>
  );
}
