import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Handshake, Plus, Trash2, CheckCircle2, AlertTriangle, Loader2, Info } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";
import { EUR } from "@/lib/finance";
import { STEUER_DISCLAIMER } from "@/lib/steuer";
import { useInsurers, useSeedInsurers } from "@/lib/insurers-store";
import {
  useInsurerContracts,
  useCreateInsurerContract,
  useDeleteInsurerContract,
} from "@/lib/insurer-contracts-store";
import { VERTRAG_EINHEITEN, type KassenvertragWrite } from "@/lib/insurer-contracts-shared";

export const Route = createFileRoute("/kassenvertraege")({
  head: () => ({
    meta: [
      { title: "Kassenverträge – GHASI AI" },
      {
        name: "description",
        content:
          "Genehmigte Preise je Krankenkasse – Grundlage der USt-Befreiung nach §4 Nr.17b UStG.",
      },
    ],
  }),
  component: KassenvertraegePage,
});

function KassenvertraegePage() {
  const { data: kassen = [] } = useInsurers();
  const seedMut = useSeedInsurers();
  const { data: vertraege = [], isLoading } = useInsurerContracts();
  const deleteMut = useDeleteInsurerContract();
  const [formInsurer, setFormInsurer] = useState<string | null>(null);

  const nameVon = (id: string) => kassen.find((k) => k.id === id)?.name ?? "Unbekannt";

  const gruppen = useMemo(() => {
    return kassen.map((k) => ({
      kasse: k,
      vertraege: vertraege.filter((v) => v.insurerId === k.id),
    }));
  }, [kassen, vertraege]);

  const onDelete = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => toast.success("Vertrag gelöscht"),
      onError: (e) => toast.error("Löschen fehlgeschlagen", { description: String(e) }),
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Kassenverträge"
        description="Vereinbarte und genehmigte Preise gegenüber den Kostenträgern – dokumentiert als Grundlage der USt-Befreiung nach §4 Nr.17b UStG."
        icon={Handshake}
        badge="Kostenträger"
      />

      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Die USt-Befreiung nach §4 Nr.17b UStG setzt <strong>genehmigte Preise</strong> gegenüber
          den Kostenträgern voraus. Hinterlegen Sie hier die vereinbarten Konditionen je Kasse.{" "}
          <span className="italic">{STEUER_DISCLAIMER}</span>
        </p>
      </div>

      {kassen.length === 0 && (
        <Card className="border-border/70 shadow-card">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Noch keine Krankenkassen hinterlegt.</p>
            <Button size="sm" disabled={seedMut.isPending} onClick={() => seedMut.mutate()}>
              Beispieldaten laden
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Verträge werden geladen …</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {gruppen.map(({ kasse, vertraege: vs }) => (
          <Card key={kasse.id} className="border-border/70 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                {kasse.name}
                <Badge variant="secondary" className="text-[10px]">
                  {kasse.kuerzel}
                </Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-primary"
                onClick={() => setFormInsurer(kasse.id)}
              >
                <Plus className="h-4 w-4" /> Preis
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {vs.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Preise hinterlegt.</p>
              )}
              {vs.map((v) => (
                <div
                  key={v.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-border/60 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{v.leistung || "Leistung"}</span>
                      {v.genehmigt ? (
                        <Badge
                          variant="outline"
                          className="border-success/30 bg-success/10 text-[10px] text-success"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" /> genehmigt
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-warning/30 bg-warning/10 text-[10px] text-warning"
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" /> offen
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {EUR(v.preis)} {v.einheit}
                      {v.aktenzeichen && ` · Az. ${v.aktenzeichen}`}
                    </p>
                    {(v.gueltigAb || v.gueltigBis) && (
                      <p className="text-[11px] text-muted-foreground">
                        Gültig {v.gueltigAb ?? "—"} bis {v.gueltigBis ?? "—"}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive"
                    onClick={() => onDelete(v.id)}
                    aria-label="Löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <VertragDialog
        insurerId={formInsurer}
        insurerName={formInsurer ? nameVon(formInsurer) : ""}
        onClose={() => setFormInsurer(null)}
      />
    </div>
  );
}

function VertragDialog({
  insurerId,
  insurerName,
  onClose,
}: {
  insurerId: string | null;
  insurerName: string;
  onClose: () => void;
}) {
  const createMut = useCreateInsurerContract();
  const [leistung, setLeistung] = useState("");
  const [preis, setPreis] = useState("");
  const [einheit, setEinheit] = useState(VERTRAG_EINHEITEN[0]);
  const [genehmigt, setGenehmigt] = useState(false);
  const [gueltigAb, setGueltigAb] = useState("");
  const [gueltigBis, setGueltigBis] = useState("");
  const [aktenzeichen, setAktenzeichen] = useState("");

  const reset = () => {
    setLeistung("");
    setPreis("");
    setEinheit(VERTRAG_EINHEITEN[0]);
    setGenehmigt(false);
    setGueltigAb("");
    setGueltigBis("");
    setAktenzeichen("");
  };

  const submit = () => {
    if (!insurerId) return;
    const values: KassenvertragWrite = {
      insurerId,
      leistung,
      preis: Number(preis) || 0,
      einheit,
      genehmigt,
      gueltigAb: gueltigAb || null,
      gueltigBis: gueltigBis || null,
      aktenzeichen,
    };
    createMut.mutate(values, {
      onSuccess: () => {
        toast.success("Preis hinterlegt");
        reset();
        onClose();
      },
      onError: (e) => toast.error("Speichern fehlgeschlagen", { description: String(e) }),
    });
  };

  return (
    <Dialog open={insurerId !== null} onOpenChange={(o) => !o && (reset(), onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preis hinterlegen</DialogTitle>
          <DialogDescription>{insurerName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Leistung / Transportart</Label>
            <Input
              value={leistung}
              onChange={(e) => setLeistung(e.target.value)}
              placeholder="z. B. Liegendtransport"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Preis (€)</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={preis}
                onChange={(e) => setPreis(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Einheit</Label>
              <Select value={einheit} onValueChange={setEinheit}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERTRAG_EINHEITEN.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Gültig ab</Label>
              <Input type="date" value={gueltigAb} onChange={(e) => setGueltigAb(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Gültig bis</Label>
              <Input type="date" value={gueltigBis} onChange={(e) => setGueltigBis(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Aktenzeichen</Label>
            <Input
              value={aktenzeichen}
              onChange={(e) => setAktenzeichen(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={genehmigt} onCheckedChange={setGenehmigt} /> Preis ist genehmigt
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={createMut.isPending || !insurerId}>
            {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
