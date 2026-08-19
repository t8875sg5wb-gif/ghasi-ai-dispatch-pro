// Lohnläufe: Anlegen und Berechnen (Finanzbereich).
// Bewusst OHNE Freigabe/Vier-Augen-Prüfung, ohne Sperre nach Freigabe, ohne
// Export und ohne Auszahlung – das folgt in einem eigenen Schritt.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, Info, Loader2, Plus, ShieldAlert, Trash2, TriangleAlert } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useDrivers } from "@/lib/drivers-store";
import { EUR2 } from "@/lib/finance";
import {
  useCalculatePayrollRun,
  useCreatePayrollRun,
  useDeletePayrollRun,
  usePayrollRunAudit,
  usePayrollRuns,
} from "@/lib/payroll-run-store";
import {
  LOHNLAUF_STATUS_LABEL,
  monatLabel,
  type Lohnlauf,
} from "@/lib/payroll-run-shared";
import { REGEL_KATEGORIE_LABEL, VERGUETUNGSART_LABEL_FALLBACK } from "@/lib/payroll-run-labels";

export const Route = createFileRoute("/lohn-laeufe")({
  component: LohnlaeufeSeite,
  head: () => ({
    meta: [
      { title: "Lohnläufe pro Fahrer und Monat | GHASI AI" },
      {
        name: "description",
        content:
          "Lohnläufe je Fahrer und Kalendermonat anlegen und aus verifizierten Grundlagen berechnen – nachvollziehbare Einzelposten, keine Schätzwerte.",
      },
      { property: "og:title", content: "Lohnläufe pro Fahrer und Monat | GHASI AI" },
      {
        property: "og:description",
        content:
          "Berechnung ausschließlich aus verifizierten Beschäftigungsverhältnissen, Regelwerken und Lohn-Eingabefakten.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function heutigerMonat(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function LohnlaufSeitenInhalt() {
  const { data: laeufe, isLoading } = usePayrollRuns();
  const { data: audit } = usePayrollRunAudit();
  const { data: fahrer } = useDrivers();

  const createMut = useCreatePayrollRun();
  const berechneMut = useCalculatePayrollRun();
  const deleteMut = useDeletePayrollRun();

  const [offen, setOffen] = useState(false);
  const [fahrerId, setFahrerId] = useState("");
  const [monat, setMonat] = useState(heutigerMonat());
  const [notiz, setNotiz] = useState("");

  const fahrerName = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of fahrer ?? []) m.set(f.id, f.name);
    return m;
  }, [fahrer]);

  async function anlegen() {
    try {
      await createMut.mutateAsync({ fahrerId, monat, notiz: notiz || undefined });
      toast.success("Lohnlauf angelegt – jetzt berechnen.");
      setOffen(false);
      setNotiz("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.");
    }
  }

  async function berechnen(lauf: Lohnlauf) {
    try {
      const res = await berechneMut.mutateAsync(lauf.id);
      if (res.status === "unvollstaendig") {
        toast.warning("Lohnlauf ist unvollständig – fehlende Grundlagen siehe Liste.");
      } else {
        toast.success("Lohnlauf berechnet.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Berechnung fehlgeschlagen.");
    }
  }

  async function loeschen(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Lohnlauf gelöscht.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Lohnläufe"
        description="Pro Fahrer und Kalendermonat anlegen und ausschließlich aus verifizierten Grundlagen berechnen."
        icon={Calculator}
      />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Berechnet wird nur aus <strong>verifizierten</strong> Beschäftigungsverhältnissen,
            Regelwerken und Lohn-Eingabefakten. Bei Stundenlohn ist die einzige zulässige
            Stundenquelle ein verifizierter Fakt <code>arbeitsstunden_JJJJ_MM</code>; der
            Schichtplan gilt als reine Planung. Fehlt eine Grundlage, wird der Lauf als
            „unvollständig“ mit Begründung gespeichert – es wird nichts geschätzt. Freigabe,
            Export und Auszahlung sind in diesem Schritt bewusst nicht enthalten.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setOffen(true)}>
          <Plus className="h-4 w-4" /> Lohnlauf anlegen
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lohnläufe werden geladen …
        </div>
      ) : (laeufe ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Noch keine Lohnläufe vorhanden.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(laeufe ?? []).map((lauf) => (
            <Card key={lauf.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-base">
                    {fahrerName.get(lauf.fahrerId) ?? "Unbekannter Fahrer"} ·{" "}
                    {monatLabel(lauf.periodeMonat)}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant={
                        lauf.status === "berechnet"
                          ? "default"
                          : lauf.status === "unvollstaendig"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {LOHNLAUF_STATUS_LABEL[lauf.status]}
                    </Badge>
                    <span>Version {lauf.version}</span>
                    {lauf.verguetungsart && (
                      <span>{VERGUETUNGSART_LABEL_FALLBACK[lauf.verguetungsart]}</span>
                    )}
                    {lauf.berechnetAm && (
                      <span>
                        berechnet am {new Date(lauf.berechnetAm).toLocaleString("de-DE")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => void berechnen(lauf)}
                    disabled={berechneMut.isPending}
                  >
                    <Calculator className="h-4 w-4" />
                    {lauf.status === "offen" ? "Berechnen" : "Neu berechnen"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void loeschen(lauf.id)}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {lauf.status === "unvollstaendig" && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <div className="mb-2 flex items-center gap-2 font-medium text-destructive">
                      <TriangleAlert className="h-4 w-4" /> Unvollständig – fehlende Grundlagen
                    </div>
                    <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                      {lauf.fehlendePunkte.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {lauf.status === "berechnet" && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <Kennzahl label="Bruttolohn" wert={lauf.brutto} />
                      <Kennzahl label="Abzüge" wert={lauf.summeAbzuege} />
                      <Kennzahl label="Netto" wert={lauf.netto} />
                      <Kennzahl label="Arbeitgeberkosten" wert={lauf.summeArbeitgeberkosten} />
                    </div>
                    {lauf.stunden !== null && (
                      <p className="text-xs text-muted-foreground">
                        Grundlage: {lauf.stunden} Stunden × {EUR2(lauf.stundenlohn ?? 0)} (geprüfte
                        Arbeitszeiterfassung)
                      </p>
                    )}
                    {lauf.posten.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-xs uppercase text-muted-foreground">
                            <tr>
                              <th className="py-2">Regel</th>
                              <th className="py-2">Kategorie</th>
                              <th className="py-2">Berechnung</th>
                              <th className="py-2">Quelle</th>
                              <th className="py-2 text-right">Betrag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lauf.posten.map((p) => (
                              <tr key={p.id} className="border-t">
                                <td className="py-2">
                                  <div className="font-medium">{p.regelBezeichnung}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {p.regelKennung}
                                  </div>
                                </td>
                                <td className="py-2">{REGEL_KATEGORIE_LABEL[p.kategorie]}</td>
                                <td className="py-2">
                                  {p.berechnungsart === "prozent"
                                    ? `${p.prozentsatz} % von ${EUR2(p.basisbetrag)}`
                                    : "Fester Betrag"}
                                </td>
                                <td className="py-2 text-xs text-muted-foreground">
                                  {p.quelle} / {p.quelleVersion}
                                </td>
                                <td className="py-2 text-right font-medium">{EUR2(p.betrag)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {lauf.notiz && <p className="text-sm text-muted-foreground">{lauf.notiz}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Änderungsprotokoll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(audit ?? []).length === 0 ? (
            <p className="text-muted-foreground">Noch keine Einträge.</p>
          ) : (
            (audit ?? []).slice(0, 30).map((a) => (
              <div key={a.id} className="flex flex-wrap gap-2 border-b pb-2 last:border-0">
                <span className="text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString("de-DE")}
                </span>
                <span className="font-medium">{a.aktion}</span>
                {a.periodeMonat && <span>{monatLabel(a.periodeMonat)}</span>}
                {a.fahrerId && <span>{fahrerName.get(a.fahrerId) ?? a.fahrerId}</span>}
                {a.version !== null && <span>Version {a.version}</span>}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lohnlauf anlegen</DialogTitle>
            <DialogDescription>
              Ein Lohnlauf gehört zu genau einem Fahrer und einem Kalendermonat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fahrer</Label>
              <Select value={fahrerId} onValueChange={setFahrerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Fahrer wählen" />
                </SelectTrigger>
                <SelectContent>
                  {(fahrer ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kalendermonat</Label>
              <Input type="month" value={monat} onChange={(e) => setMonat(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Zeitraum ist immer der 1. bis letzte Tag des Monats.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notiz (optional)</Label>
              <Textarea rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <Button
              className="gap-2"
              onClick={() => void anlegen()}
              disabled={!fahrerId || !monat || createMut.isPending}
            >
              {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Anlegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kennzahl({ label, wert }: { label: string; wert: number | null }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{wert === null ? "–" : EUR2(wert)}</div>
    </div>
  );
}

function LohnlaeufeSeite() {
  const { hatRolle } = useAuth();
  const berechtigt = hatRolle("admin") || hatRolle("finanz");

  if (!berechtigt) {
    return (
      <div className="space-y-6">
        <PageHero
          title="Lohnläufe"
          description="Dieser Bereich ist Administration und Finanzen vorbehalten."
          icon={Calculator}
        />
        <Card className="border-destructive/30">
          <CardContent className="flex gap-3 p-6 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p>Kein Zugriff: Lohnläufe dürfen nur von Administration oder Finanzen genutzt werden.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <LohnlaufSeitenInhalt />;
}
