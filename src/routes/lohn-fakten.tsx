import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Info,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  UserCog,
} from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useDrivers } from "@/lib/drivers-store";
import {
  useCreatePayrollFact,
  useDeletePayrollFact,
  usePayrollFactAudit,
  usePayrollFacts,
  useUpdatePayrollFact,
  useVerifyPayrollFact,
} from "@/lib/payroll-store";
import { LOHN_FAKT_STATUS_LABEL, type LohnFakt, type LohnFaktWrite } from "@/lib/payroll-shared";

export const Route = createFileRoute("/lohn-fakten")({
  head: () => ({
    meta: [
      { title: "Lohn-Eingabefakten – GHASI AI" },
      {
        name: "description",
        content:
          "Geprüfte Lohn-Eingabefakten je Fahrer: frei benennbare Fakten mit Gültigkeitszeitraum, Vier-Augen-Prüfung und Versionshistorie.",
      },
      { property: "og:title", content: "Lohn-Eingabefakten – GHASI AI" },
      {
        property: "og:description",
        content:
          "Steuerklasse, KV-Status & weitere Fakten je Fahrer – verifiziert im Vier-Augen-Prinzip, vollständig protokolliert.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LohnFaktenPage,
});

interface FormState {
  fahrerId: string;
  faktSchluessel: string;
  wert: string;
  gueltigAb: string;
  gueltigBis: string;
  notiz: string;
}

const LEER: FormState = {
  fahrerId: "",
  faktSchluessel: "",
  wert: "",
  gueltigAb: "",
  gueltigBis: "",
  notiz: "",
};

function LohnFaktenPage() {
  const { role, user } = useAuth();
  const berechtigt = role === "admin" || role === "finanz";

  const { data: fahrer = [] } = useDrivers();
  const { data: fakten = [], isLoading, error } = usePayrollFacts(berechtigt);
  const { data: audit = [] } = usePayrollFactAudit(berechtigt);

  const createMut = useCreatePayrollFact();
  const updateMut = useUpdatePayrollFact();
  const verifyMut = useVerifyPayrollFact();
  const deleteMut = useDeletePayrollFact();

  const [offen, setOffen] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(LEER);

  const nameVon = (id: string) => fahrer.find((f) => f.id === id)?.name ?? "Unbekannter Fahrer";

  const sortiert = useMemo(
    () =>
      [...fakten].sort(
        (a, b) =>
          nameVon(a.fahrerId).localeCompare(nameVon(b.fahrerId)) ||
          a.faktSchluessel.localeCompare(b.faktSchluessel) ||
          (a.gueltigAb < b.gueltigAb ? 1 : -1),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fakten, fahrer],
  );

  if (!berechtigt) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHero
          title="Lohn-Eingabefakten"
          description="Lohnrelevante Fakten je Fahrer – ausschließlich für Administration und Finanzen."
          icon={UserCog}
          badge="Finanzen"
        />
        <Card className="border-border/70 shadow-card">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Diese Daten sind Administration und Finanzen vorbehalten.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const oeffnenNeu = () => {
    setBearbeiteId(null);
    setForm(LEER);
    setOffen(true);
  };

  const oeffnenBearbeiten = (f: LohnFakt) => {
    setBearbeiteId(f.id);
    setForm({
      fahrerId: f.fahrerId,
      faktSchluessel: f.faktSchluessel,
      wert: f.wert,
      gueltigAb: f.gueltigAb,
      gueltigBis: f.gueltigBis ?? "",
      notiz: f.notiz,
    });
    setOffen(true);
  };

  const speichern = () => {
    // Bewusst keine Vorbelegung: ohne vollständige Eingabe wird nicht gespeichert.
    if (!form.fahrerId || !form.faktSchluessel.trim() || !form.wert.trim() || !form.gueltigAb) {
      toast.error("Bitte Fahrer, Fakten-Schlüssel, Wert und Startdatum vollständig angeben.");
      return;
    }
    const values: LohnFaktWrite = {
      fahrerId: form.fahrerId,
      faktSchluessel: form.faktSchluessel.trim(),
      wert: form.wert.trim(),
      gueltigAb: form.gueltigAb,
      gueltigBis: form.gueltigBis ? form.gueltigBis : null,
      notiz: form.notiz,
    };

    const onError = (e: unknown) =>
      toast.error("Speichern fehlgeschlagen", { description: String((e as Error)?.message ?? e) });

    if (bearbeiteId) {
      updateMut.mutate(
        { id: bearbeiteId, values },
        {
          onSuccess: () => {
            toast.success("Gespeichert – erneute Prüfung erforderlich");
            setOffen(false);
          },
          onError,
        },
      );
    } else {
      createMut.mutate(values, {
        onSuccess: () => {
          toast.success("Angelegt – Prüfung erforderlich");
          setOffen(false);
        },
        onError,
      });
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Lohn-Eingabefakten"
        description="Einzelne, benannte Fakten je Fahrer (z. B. Steuerklasse, KV-Status, Kinderfreibeträge) – mit Zeitraum, Prüfpflicht und Versionshistorie."
        icon={UserCog}
        badge="Finanzen"
      />

      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Jeder Fakt startet im Status <strong>Prüfung erforderlich</strong> und muss von einer
          zweiten berechtigten Person verifiziert werden. Verifizierte Fakten desselben Fahrers mit
          demselben Schlüssel dürfen sich zeitlich nicht überschneiden. Es werden keine Werte
          geschätzt oder vorbelegt. Eine Lohnberechnung findet hier bewusst nicht statt.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={oeffnenNeu} className="gap-2">
          <Plus className="h-4 w-4" /> Neuer Lohn-Fakt
        </Button>
      </div>

      <Card className="border-border/70 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Lohn-Eingabefakten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Daten …
            </div>
          )}
          {error && (
            <p className="py-4 text-sm text-destructive">
              {String((error as Error)?.message ?? error)}
            </p>
          )}
          {!isLoading && sortiert.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">Noch keine Fakten erfasst.</p>
          )}

          {sortiert.map((f) => (
            <div
              key={f.id}
              className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{nameVon(f.fahrerId)}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {f.faktSchluessel}
                  </Badge>
                  <Badge variant={f.status === "verifiziert" ? "default" : "secondary"}>
                    {LOHN_FAKT_STATUS_LABEL[f.status]}
                  </Badge>
                  <Badge variant="outline">Version {f.version}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Wert: <strong>{f.wert}</strong> · ab {f.gueltigAb}
                  {f.gueltigBis ? ` bis ${f.gueltigBis}` : " (offenes Ende)"}
                </p>
                {f.notiz && <p className="text-xs text-muted-foreground">{f.notiz}</p>}
                {f.status === "verifiziert" && f.verifiziertAm && (
                  <p className="text-xs text-muted-foreground">
                    Verifiziert am {new Date(f.verifiziertAm).toLocaleDateString("de-DE")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {f.status !== "verifiziert" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={verifyMut.isPending || f.erstelltVon === user?.id}
                    title={
                      f.erstelltVon === user?.id
                        ? "Vier-Augen-Prinzip: Eigene Einträge dürfen nicht selbst verifiziert werden."
                        : "Verifizieren"
                    }
                    onClick={() =>
                      verifyMut.mutate(f.id, {
                        onSuccess: () => toast.success("Verifiziert"),
                        onError: (e) =>
                          toast.error("Verifizierung nicht möglich", {
                            description: String(e?.message ?? e),
                          }),
                      })
                    }
                  >
                    <BadgeCheck className="h-4 w-4" /> Verifizieren
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => oeffnenBearbeiten(f)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={deleteMut.isPending}
                  onClick={() =>
                    deleteMut.mutate(f.id, {
                      onSuccess: () => toast.success("Gelöscht"),
                      onError: (e) =>
                        toast.error("Löschen fehlgeschlagen", {
                          description: String(e?.message ?? e),
                        }),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Änderungsprotokoll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {audit.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Änderungen protokolliert.</p>
          )}
          {audit.map((a) => (
            <div key={a.id} className="rounded-md border border-border/50 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{a.aktion}</Badge>
                <span className="text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString("de-DE")}
                </span>
                {a.version !== null && (
                  <span className="text-muted-foreground">· Version {a.version}</span>
                )}
              </div>
              <p className="mt-1 text-muted-foreground">
                {a.fahrerId ? nameVon(a.fahrerId) : "Unbekannter Fahrer"}
                {a.bezeichner ? ` · ${a.bezeichner}` : ""} · Akteur{" "}
                {a.akteurUserId ? a.akteurUserId.slice(0, 8) : "System"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{bearbeiteId ? "Lohn-Fakt ändern" : "Neuer Lohn-Fakt"}</DialogTitle>
            <DialogDescription>
              Alle Angaben werden manuell erfasst. Nach dem Speichern ist eine Prüfung durch eine
              zweite berechtigte Person erforderlich.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Fahrer</Label>
              <Select
                value={form.fahrerId}
                onValueChange={(v) => setForm((f) => ({ ...f, fahrerId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Fahrer wählen" />
                </SelectTrigger>
                <SelectContent>
                  {fahrer.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fakten-Schlüssel</Label>
              <Input
                placeholder="z. B. steuerklasse"
                value={form.faktSchluessel}
                onChange={(e) => setForm((f) => ({ ...f, faktSchluessel: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Frei benennbar – nur Kleinbuchstaben, Ziffern und Unterstriche (2–60 Zeichen).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Wert</Label>
              <Input
                value={form.wert}
                onChange={(e) => setForm((f) => ({ ...f, wert: e.target.value }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Gültig ab</Label>
                <Input
                  type="date"
                  value={form.gueltigAb}
                  onChange={(e) => setForm((f) => ({ ...f, gueltigAb: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Gültig bis (optional)</Label>
                <Input
                  type="date"
                  value={form.gueltigBis}
                  onChange={(e) => setForm((f) => ({ ...f, gueltigBis: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notiz (optional)</Label>
              <Textarea
                rows={2}
                value={form.notiz}
                onChange={(e) => setForm((f) => ({ ...f, notiz: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={speichern}
              disabled={createMut.isPending || updateMut.isPending}
              className="gap-2"
            >
              {(createMut.isPending || updateMut.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
