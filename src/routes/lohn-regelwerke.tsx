import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  BookText,
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
import {
  useCreatePayrollRule,
  useDeletePayrollRule,
  usePayrollRuleAudit,
  usePayrollRules,
  useUpdatePayrollRule,
  useVerifyPayrollRule,
} from "@/lib/payroll-store";
import {
  REGEL_ART_LABEL,
  REGEL_KATEGORIE_LABEL,
  REGEL_STATUS_LABEL,
  type LohnRegel,
  type LohnRegelWrite,
  type RegelBerechnungsart,
  type RegelKategorie,
} from "@/lib/payroll-shared";

export const Route = createFileRoute("/lohn-regelwerke")({
  head: () => ({
    meta: [
      { title: "Lohn-Regelwerke – GHASI AI" },
      {
        name: "description",
        content:
          "Abzugs- und Arbeitgeberkostenregeln mit Pflicht-Quellenangabe, Gültigkeitszeitraum, Vier-Augen-Prüfung und Versionshistorie.",
      },
      { property: "og:title", content: "Lohn-Regelwerke – GHASI AI" },
      {
        property: "og:description",
        content:
          "Prozentsatz oder fester Betrag – jede Regel mit Quelle und Quellen-Version, verifiziert im Vier-Augen-Prinzip.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LohnRegelwerkePage,
});

interface FormState {
  kennung: string;
  bezeichnung: string;
  kategorie: RegelKategorie;
  berechnungsart: RegelBerechnungsart;
  wert: string;
  gueltigAb: string;
  gueltigBis: string;
  quelle: string;
  quelleVersion: string;
  notiz: string;
}

const LEER: FormState = {
  kennung: "",
  bezeichnung: "",
  kategorie: "arbeitnehmerabzug",
  berechnungsart: "prozent",
  wert: "",
  gueltigAb: "",
  gueltigBis: "",
  quelle: "",
  quelleVersion: "",
  notiz: "",
};

function LohnRegelwerkePage() {
  const { role, user } = useAuth();
  const berechtigt = role === "admin" || role === "finanz";

  const { data: regeln = [], isLoading, error } = usePayrollRules(berechtigt);
  const { data: audit = [] } = usePayrollRuleAudit(berechtigt);

  const createMut = useCreatePayrollRule();
  const updateMut = useUpdatePayrollRule();
  const verifyMut = useVerifyPayrollRule();
  const deleteMut = useDeletePayrollRule();

  const [offen, setOffen] = useState(false);
  const [bearbeiteId, setBearbeiteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(LEER);

  const sortiert = useMemo(
    () =>
      [...regeln].sort(
        (a, b) => a.kennung.localeCompare(b.kennung) || (a.gueltigAb < b.gueltigAb ? 1 : -1),
      ),
    [regeln],
  );

  if (!berechtigt) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHero
          title="Lohn-Regelwerke"
          description="Abzugs- und Arbeitgeberkostenregeln – ausschließlich für Administration und Finanzen."
          icon={BookText}
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

  const oeffnenBearbeiten = (r: LohnRegel) => {
    setBearbeiteId(r.id);
    setForm({
      kennung: r.kennung,
      bezeichnung: r.bezeichnung,
      kategorie: r.kategorie,
      berechnungsart: r.berechnungsart,
      wert: String(r.berechnungsart === "prozent" ? (r.prozentsatz ?? "") : (r.festbetrag ?? "")),
      gueltigAb: r.gueltigAb,
      gueltigBis: r.gueltigBis ?? "",
      quelle: r.quelle,
      quelleVersion: r.quelleVersion,
      notiz: r.notiz,
    });
    setOffen(true);
  };

  const speichern = () => {
    // Bewusst keine Vorbelegung: ohne explizite Eingabe wird nicht gespeichert.
    const wert = Number(form.wert.replace(",", "."));
    if (
      !form.kennung.trim() ||
      !form.bezeichnung.trim() ||
      !form.wert.trim() ||
      !Number.isFinite(wert) ||
      !form.gueltigAb
    ) {
      toast.error("Bitte Kennung, Bezeichnung, Wert und Startdatum vollständig angeben.");
      return;
    }
    if (!form.quelle.trim() || !form.quelleVersion.trim()) {
      toast.error("Quellenangabe und Quellen-Version sind Pflicht.");
      return;
    }
    const values: LohnRegelWrite = {
      kennung: form.kennung.trim(),
      bezeichnung: form.bezeichnung.trim(),
      kategorie: form.kategorie,
      berechnungsart: form.berechnungsart,
      prozentsatz: form.berechnungsart === "prozent" ? wert : null,
      festbetrag: form.berechnungsart === "festbetrag" ? wert : null,
      gueltigAb: form.gueltigAb,
      gueltigBis: form.gueltigBis ? form.gueltigBis : null,
      quelle: form.quelle.trim(),
      quelleVersion: form.quelleVersion.trim(),
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
          toast.success("Als Entwurf angelegt – Prüfung erforderlich");
          setOffen(false);
        },
        onError,
      });
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Lohn-Regelwerke"
        description="Organisationsweite Abzugs- und Arbeitgeberkostenregeln: Prozentsatz vom Bruttolohn ODER fester Betrag – jede Regel mit Pflicht-Quellenangabe."
        icon={BookText}
        badge="Finanzen"
      />

      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Jede Regel braucht eine <strong>Quellenangabe</strong> und deren{" "}
          <strong>Versionsangabe</strong> – ohne Quelle ist keine Anlage möglich. Neue Regeln
          starten als <strong>Entwurf</strong> und müssen von einer zweiten berechtigten Person
          verifiziert werden. Verifizierte Regeln derselben Kennung dürfen sich zeitlich nicht
          überschneiden. Es findet hier bewusst keine Lohnberechnung und keine automatische
          Anwendung auf Fahrer statt.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={oeffnenNeu} className="gap-2">
          <Plus className="h-4 w-4" /> Neue Regel
        </Button>
      </div>

      <Card className="border-border/70 shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Regelwerke</CardTitle>
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
            <p className="py-6 text-sm text-muted-foreground">Noch keine Regeln erfasst.</p>
          )}

          {sortiert.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.bezeichnung}</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {r.kennung}
                  </Badge>
                  <Badge variant="secondary">{REGEL_KATEGORIE_LABEL[r.kategorie]}</Badge>
                  <Badge variant={r.status === "verifiziert" ? "default" : "secondary"}>
                    {REGEL_STATUS_LABEL[r.status]}
                  </Badge>
                  <Badge variant="outline">Version {r.version}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {REGEL_ART_LABEL[r.berechnungsart]}:{" "}
                  <strong>
                    {r.berechnungsart === "prozent"
                      ? `${(r.prozentsatz ?? 0).toLocaleString("de-DE")} %`
                      : EUR2(r.festbetrag ?? 0)}
                  </strong>{" "}
                  · ab {r.gueltigAb}
                  {r.gueltigBis ? ` bis ${r.gueltigBis}` : " (offenes Ende)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Quelle: {r.quelle} · Stand/Version: {r.quelleVersion}
                </p>
                {r.notiz && <p className="text-xs text-muted-foreground">{r.notiz}</p>}
                {r.status === "verifiziert" && r.verifiziertAm && (
                  <p className="text-xs text-muted-foreground">
                    Verifiziert am {new Date(r.verifiziertAm).toLocaleDateString("de-DE")}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {r.status !== "verifiziert" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={verifyMut.isPending || r.erstelltVon === user?.id}
                    title={
                      r.erstelltVon === user?.id
                        ? "Vier-Augen-Prinzip: Eigene Regeln dürfen nicht selbst verifiziert werden."
                        : "Verifizieren"
                    }
                    onClick={() =>
                      verifyMut.mutate(r.id, {
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
                <Button size="sm" variant="ghost" onClick={() => oeffnenBearbeiten(r)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={deleteMut.isPending}
                  onClick={() =>
                    deleteMut.mutate(r.id, {
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
                {a.bezeichner ?? "Unbekannte Kennung"} · Akteur{" "}
                {a.akteurUserId ? a.akteurUserId.slice(0, 8) : "System"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{bearbeiteId ? "Regel ändern" : "Neue Regel"}</DialogTitle>
            <DialogDescription>
              Alle Angaben werden manuell erfasst. Quelle und Quellen-Version sind Pflicht; nach dem
              Speichern ist eine Prüfung durch eine zweite berechtigte Person erforderlich.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kennung</Label>
                <Input
                  placeholder="z. B. kv_arbeitgeber"
                  value={form.kennung}
                  onChange={(e) => setForm((f) => ({ ...f, kennung: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Bezeichnung</Label>
                <Input
                  value={form.bezeichnung}
                  onChange={(e) => setForm((f) => ({ ...f, bezeichnung: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select
                value={form.kategorie}
                onValueChange={(v) => setForm((f) => ({ ...f, kategorie: v as RegelKategorie }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arbeitnehmerabzug">Arbeitnehmerabzug</SelectItem>
                  <SelectItem value="arbeitgeberkosten">Arbeitgeberkosten</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Berechnungsart</Label>
              <Select
                value={form.berechnungsart}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, berechnungsart: v as RegelBerechnungsart, wert: "" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prozent">Prozentsatz vom Bruttolohn</SelectItem>
                  <SelectItem value="festbetrag">Fester Betrag</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Es ist immer nur eine Berechnungsart möglich – nie beides gleichzeitig.
              </p>
            </div>

            <div className="space-y-2">
              <Label>
                {form.berechnungsart === "prozent" ? "Prozentsatz (%)" : "Fester Betrag (EUR)"}
              </Label>
              <Input
                inputMode="decimal"
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quelle (Pflicht)</Label>
                <Input
                  placeholder="z. B. § 249 SGB V"
                  value={form.quelle}
                  onChange={(e) => setForm((f) => ({ ...f, quelle: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Quellen-Version (Pflicht)</Label>
                <Input
                  placeholder="z. B. Stand 2026-01-01"
                  value={form.quelleVersion}
                  onChange={(e) => setForm((f) => ({ ...f, quelleVersion: e.target.value }))}
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
