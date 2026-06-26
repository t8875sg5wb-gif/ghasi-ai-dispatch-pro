import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { HeartPulse, Search, Shield, UserCheck, FileText } from "lucide-react";

import { PATIENTEN, type Patient } from "@/lib/stammdaten";
import {
  INITIAL_AUFTRAEGE,
  MOBILITAET_META,
  VERORDNUNG_META,
  STATUS_META,
  effektiveMobilitaet,
  effektiveVerordnung,
  formatTermin,
  type Mobilitaet,
} from "@/lib/auftraege";
import { MedizinBadges, fahrzeugMismatch } from "@/components/auftraege/medizin-details";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/patienten")({
  head: () => ({
    meta: [
      { title: "Patienten – GHASI AI" },
      { name: "description", content: "Patientenakten, Mobilität und Transportbedarf verwalten." },
    ],
  }),
  component: PatientenSeite,
});

/** Übersetzt das Stammdaten-Mobilitätslabel in den feineren Mobilitäts-Typ. */
function mobilitaetTyp(p: Patient): Mobilitaet {
  switch (p.mobilitaet) {
    case "Rollstuhl":
      return "rollstuhl";
    case "Liegend":
      return "liegend";
    default:
      return "gehfaehig";
  }
}

function PatientenSeite() {
  const [suche, setSuche] = useState("");
  const [aktiv, setAktiv] = useState<string | null>(PATIENTEN[0]?.id ?? null);

  const gefiltert = PATIENTEN.filter(
    (p) =>
      p.name.toLowerCase().includes(suche.toLowerCase()) ||
      p.kostentraeger.toLowerCase().includes(suche.toLowerCase()),
  );
  const patient = PATIENTEN.find((p) => p.id === aktiv) ?? gefiltert[0] ?? null;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HeartPulse className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Patienten</h1>
          <p className="text-sm text-muted-foreground">
            Patientenakten, Mobilität, Verordnung und Transportbedarf.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Liste */}
        <Card>
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Patient suchen…"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {gefiltert.map((p) => {
              const mob = MOBILITAET_META[mobilitaetTyp(p)];
              return (
                <button
                  key={p.id}
                  onClick={() => setAktiv(p.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-colors",
                    patient?.id === p.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-transparent hover:bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{p.name}</span>
                    <Badge className={cn("gap-1 text-[10px]", mob.badge)}>
                      <mob.icon className="h-3 w-3" />
                      {mob.kurz}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.kostentraeger}</p>
                </button>
              );
            })}
            {gefiltert.length === 0 && (
              <p className="px-1 py-4 text-sm text-muted-foreground">Keine Treffer.</p>
            )}
          </CardContent>
        </Card>

        {/* Profil */}
        {patient && <PatientProfil patient={patient} />}
      </div>
    </div>
  );
}

function PatientProfil({ patient }: { patient: Patient }) {
  const mob = MOBILITAET_META[mobilitaetTyp(patient)];
  const transporte = INITIAL_AUFTRAEGE.filter((a) => a.patient === patient.name);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{patient.name}</span>
            <Badge className={cn("gap-1", mob.badge)}>
              <mob.icon className="h-3.5 w-3.5" />
              {mob.label}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ProfilZeile icon={Shield} label="Kostenträger" value={patient.kostentraeger} />
            <ProfilZeile
              icon={UserCheck}
              label="Begleitperson"
              value={patient.begleitperson ? "Ja – standardmäßig" : "Nein"}
            />
          </div>
          {patient.hinweis && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Hinweis</p>
              <p className="text-sm">{patient.hinweis}</p>
            </div>
          )}
          {patient.medizinischeNotiz && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
              <p className="text-xs font-medium text-warning">Medizinische Notiz</p>
              <p className="text-sm">{patient.medizinischeNotiz}</p>
            </div>
          )}
          {patient.patientennotiz && (
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Patientennotiz</p>
              <p className="text-sm">{patient.patientennotiz}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Transporte & Verordnungen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {transporte.length === 0 && (
            <p className="text-sm text-muted-foreground">Keine Transporte erfasst.</p>
          )}
          {transporte.map((a) => {
            const ver = VERORDNUNG_META[effektiveVerordnung(a)];
            const mismatch = fahrzeugMismatch(a);
            return (
              <div key={a.id} className="rounded-xl border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{a.nummer}</span>
                  <Badge variant="outline" className={cn("gap-1", STATUS_META[a.status].badge)}>
                    {STATUS_META[a.status].label}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {a.abholort} → {a.zielort} · {formatTermin(a.termin)}
                </p>
                <MedizinBadges auftrag={a} className="mt-2" />
                <div className="mt-2 flex items-center gap-1 text-xs">
                  <ver.icon className={cn("h-3.5 w-3.5", ver.text)} />
                  <span className="text-muted-foreground">Verordnung:</span>
                  <span className="font-medium">{ver.label}</span>
                </div>
                {mismatch && (
                  <p className="mt-1 text-xs font-medium text-warning">{mismatch}</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfilZeile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Shield;
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
