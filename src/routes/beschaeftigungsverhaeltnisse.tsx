import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  ClipboardCheck,
  Info,
  Loader2,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
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
import { EUR2 } from "@/lib/finance";
import { useAuth } from "@/hooks/use-auth";
import { useDrivers } from "@/lib/drivers-store";
import {
  useCreateEmployment,
  useDeleteEmployment,
  useEmploymentAudit,
  useEmployments,
  useUpdateEmployment,
  useVerifyEmployment,
} from "@/lib/employment-store";
import {
  BESCHAEFTIGUNG_STATUS_LABEL,
  VERGUETUNGSART_LABEL,
  type Beschaeftigungsverhaeltnis,
  type BeschaeftigungsverhaeltnisWrite,
  type Verguetungsart,
} from "@/lib/employment-shared";

export const Route = createFileRoute("/beschaeftigungsverhaeltnisse")({
  head: () => ({
    meta: [
      { title: "Beschäftigungsverhältnisse – GHASI AI" },
      {
        name: "description",
        content:
          "Vergütung je Fahrer dokumentieren: Stundenlohn oder festes Monatsbrutto, mit Prüfpflicht und Versionshistorie.",
      },
      { property: "og:title", content: "Beschäftigungsverhältnisse – GHASI AI" },
      {
        property: "og:description",
        content:
          "Stundenlohn oder Monatsbrutto je Fahrer – verifiziert im Vier-Augen-Prinzip, vollständig protokolliert.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BeschaeftigungPage,
});

interface FormState {
  fahrerId: string;
  verguetungsart: Verguetungsart;
  betrag: string;
  gueltigAb: string;
  gueltigBis: string;
  notiz: string;
}

const LEER: FormState = {
  fahrerId: "",
  verguetungsart: "stundenlohn",
  betrag: "",
  gueltigAb: "",
  gueltigBis: "",
  notiz: "",
};

function BeschaeftigungPage() {
  const { role, user } = useAuth();
  const berechtigt = role === "admin" || role === "finanz";

  const { data: fahrer = [] } = useDrivers();
  const { data: saetze = [], isLoading, error } = useEmployments(berechtigt);
  const { data: audit = [] } = useEmploymentAudit(berechtigt);

  const createMut = useCreateEmployment();
  const updateMut = useUpdateEmployment();
  const verifyMut = useVerifyEmployment();
  const deleteMut = useDeleteEmployment();

  const [offen, setOffen] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(LEER);

  const nameVon = (id: string) => fahrer.find((f) => f.id === id)?.name ?? "Unbekannter Fahrer";

  const sortiert = useMemo(
    () =>
      [...saetze].sort(
        (a, b) =>
          nameVon(a.fahrerId).localeCompare(nameVon(b.fahrerId)) ||
          (a.gueltigAb < b.gueltigAb ? 1 : -1),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saetze, fahrer],
  );

  if (!berechtigt) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHero
          title="Beschäftigungsverhältnisse"
          description="Vergütungsdaten der Fahrer – ausschließlich für Administration und Finanzen."
          icon={ClipboardCheck}
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

  const oeffnenBearbeiten = (v: Beschaeftigungsverhaeltnis) => {
    setBearbeiteId(v.id);
    setForm({
      fahrerId: v.fahrerId,
      verguetungsart: v.verguetungsart,
      betrag: String(
        v.verguetungsart === "stundenlohn" ? (v.stundenlohn ?? "") : (v.monatsbrutto ?? ""),
      ),
      gueltigAb: v.gueltigAb,
      gueltigBis: v.gueltigBis ?? "",
      notiz: v.notiz,
    });
    setOffen(true);
  };

  const speichern = () => {
    // Bewusst keine Vorbelegung: ohne explizite Eingabe wird nicht gespeichert.
    const betrag = Number(form.betrag.replace(",", "."));
    if (!form.fahrerId || !form.gueltigAb || !form.betrag.trim() || !Number.isFinite(betrag)) {
      toast.error("Bitte Fahrer, Betrag und Startdatum vollständig angeben.");
      return;
    }
    const values: BeschaeftigungsverhaeltnisWrite = {
      fahrerId: form.fahrerId,
      verguetungsart: form.verguetungsart,
      stundenlohn: form.verguetungsart === "stundenlohn" ? betrag : null,
      monatsbrutto: form.verguetungsart === "monatsbrutto" ? betrag : null,
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

  const verifizieren = (v: Beschaeftigungsverhaeltnis) => {
    verifyMut.mutate(v.id, {
      onSuccess: () => toast.success("Verifiziert"),
      onError: (e) =>
        toast.error("Verifizierung nicht möglich", { description: String(e?.message ?? e) }),
    });
  };

  const loeschen = (v: Beschaeftigungsverhaeltnis) => {
    deleteMut.mutate(v.id, {
      onSuccess: () => toast.success("Gelöscht"),
      onError: (e) =>
        toast.error("Löschen fehlgeschlagen", { description: String(e?.message ?? e) }),
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Beschäftigungsverhältnisse"
        description="Wie wird ein Fahrer bezahlt? Stundenlohn ODER festes Monatsbrutto – mit Zeitraum, Prüfpflicht und Versionshistorie."
        icon={ClipboardCheck}
        badge="Finanzen"
      />

      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Jeder Datensatz startet im Status <strong>Prüfung erforderlich</strong> und muss von einer
          zweiten berechtigten Person verifiziert werden. Verifizierte Zeiträume desselben Fahrers
          dürfen sich nicht überschneiden. Es werden keine Beträge geschätzt oder automatisch
          befüllt. Eine Lohnberechnung findet hier bewusst nicht statt.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={oeffnenNeu} className="gap-2">
          <Plus className="h-4 w-4" /> Neues Beschäftigungsverhältnis
        </Button>
      </div>

      <Card className="border-border/70 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Beschäftigungsverhältnisse</CardTitle>
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
            <p className="py-6 text-sm text-muted-foreground">
              Noch keine Beschäftigungsverhältnisse erfasst.
            </p>
          )}

          {sortiert.map((v) => (
            <div
              key={v.id}
              className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{nameVon(v.fahrerId)}</span>
                  <Badge variant={v.status === "verifiziert" ? "default" : "secondary"}>
                    {BESCHAEFTIGUNG_STATUS_LABEL[v.status]}
                  </Badge>
                  <Badge variant="outline">Version {v.version}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {VERGUETUNGSART_LABEL[v.verguetungsart]}:{" "}
                  <strong>
                    {EUR2(
                      (v.verguetungsart === "stundenlohn" ? v.stundenlohn : v.monatsbrutto) ?? 0,
                    )}
                  </strong>
                  {v.verguetungsart === "stundenlohn" ? " / Std." : " / Monat"} · ab {v.gueltigAb}
                  {v.gueltigBis ? ` bis ${v.gueltigBis}` : " (offenes Ende)"}
                </p>
                {v.notiz && <p className="text-xs text-muted-foreground">{v.notiz}</p>}
                {v.status === "verifiziert" && v.verifiziertAm && (
                  <p className="text-xs text-muted-foreground">
                    Verifiziert am {new Date(v.verifiziertAm).toLocaleDateString("de-DE")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {v.status !== "verifiziert" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={verifyMut.isPending || v.erstelltVon === user?.id}
                    title={
                      v.erstelltVon === user?.id
                        ? "Vier-Augen-Prinzip: Eigene Einträge dürfen nicht selbst verifiziert werden."
                        : "Verifizieren"
                    }
                    onClick={() => verifizieren(v)}
                  >
                    <BadgeCheck className="h-4 w-4" /> Verifizieren
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => oeffnenBearbeiten(v)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={deleteMut.isPending}
                  onClick={() => loeschen(v)}
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
                {a.fahrerId ? nameVon(a.fahrerId) : "Unbekannter Fahrer"} · Akteur{" "}
                {a.akteurUserId ? a.akteurUserId.slice(0, 8) : "System"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {bearbeiteId ? "Beschäftigungsverhältnis ändern" : "Neues Beschäftigungsverhältnis"}
            </DialogTitle>
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
              <Label>Vergütungsart</Label>
              <Select
                value={form.verguetungsart}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, verguetungsart: v as Verguetungsart, betrag: "" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stundenlohn">Stundenlohn</SelectItem>
                  <SelectItem value="monatsbrutto">Festes Monatsbrutto</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Es ist immer nur eine Vergütungsart möglich – nie beides gleichzeitig.
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                {form.verguetungsart === "stundenlohn"
                  ? "Stundenlohn (EUR brutto je Stunde)"
                  : "Monatsbrutto (EUR)"}
              </Label>
              <Input
                inputMode="decimal"
                placeholder=""
                value={form.betrag}
                onChange={(e) => setForm((f) => ({ ...f, betrag: e.target.value }))}
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
