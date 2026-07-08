import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Trash2, Loader2, Info, Paperclip } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useVehicles } from "@/lib/vehicles-store";
import { useDrivers } from "@/lib/drivers-store";
import { useUploadDocument } from "@/lib/documents-store";
import { useCompanySettings } from "@/lib/company-settings-store";
import {
  useExpenses,
  useCreateExpense,
  useDeleteExpense,
  useSeedExpenses,
} from "@/lib/expenses-store";
import {
  AUSGABE_KATEGORIEN,
  enthalteneVorsteuer,
  nettoBetrag,
  type Ausgabe,
  type AusgabeKategorie,
  type AusgabeWrite,
} from "@/lib/expenses-shared";
import { EUR } from "@/lib/finance";
import { useAuth } from "@/hooks/use-auth";
import { downloadCsv, toCsv } from "@/lib/export-utils";

export const Route = createFileRoute("/ausgaben")({
  head: () => ({
    meta: [
      { title: "Ausgaben – GHASI AI" },
      {
        name: "description",
        content: "Betriebsausgaben mit Belegfotos, Kategorien und Vorsteuer-Hinweis.",
      },
    ],
  }),
  component: AusgabenPage,
});

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

function AusgabenPage() {
  const { data: expenses = [], isLoading } = useExpenses();
  const { data: company } = useCompanySettings();
  const delMut = useDeleteExpense();
  const seedMut = useSeedExpenses();
  const [open, setOpen] = useState(false);

  const exempt = company?.steuerModus !== "regulaer_19";

  const summe = useMemo(() => {
    const brutto = expenses.reduce((s, e) => s + e.betragBrutto, 0);
    const vorsteuer = expenses.reduce((s, e) => s + enthalteneVorsteuer(e), 0);
    return { brutto, vorsteuer, netto: brutto - vorsteuer };
  }, [expenses]);

  function exportCsv() {
    const rows = expenses.map((e) => ({
      Datum: e.datum,
      Kategorie: e.kategorie,
      Lieferant: e.lieferant,
      "Brutto (EUR)": e.betragBrutto.toFixed(2),
      "USt-Satz (%)": e.ustSatz,
      "Enthaltene Vorsteuer (EUR)": enthalteneVorsteuer(e).toFixed(2),
      Notiz: e.notiz ?? "",
    }));
    downloadCsv(`ausgaben-${new Date().getFullYear()}.csv`, toCsv(rows));
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHero
        title="Ausgaben"
        description="Betriebsausgaben mit Belegfotos erfassen. Kategorien, USt-Satz und Vorsteuer werden automatisch ausgewiesen."
        icon={Receipt}
        badge="Finanzen"
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Ausgabe erfassen
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Ausgaben (brutto)" value={EUR(summe.brutto)} icon={Receipt} tone="primary" />
        <StatCard label="Netto" value={EUR(summe.netto)} icon={Receipt} tone="info" />
        <StatCard
          label={exempt ? "Nicht abziehbare Vorsteuer" : "Abziehbare Vorsteuer"}
          value={EUR(summe.vorsteuer)}
          icon={Info}
          tone={exempt ? "warning" : "success"}
        />
      </div>

      {exempt && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Im umsatzsteuerbefreiten Modus (§4 Nr.17b UStG) ist die enthaltene Vorsteuer{" "}
            <strong>nicht abziehbar</strong> (§15 Abs.2 UStG). Ausgaben werden daher brutto gebucht.
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Belege</CardTitle>
          <div className="flex gap-2">
            {expenses.length === 0 && (
              <Button variant="outline" size="sm" disabled={seedMut.isPending} onClick={() => seedMut.mutate(undefined, { onSuccess: (r) => toast.success(`${r.seeded} Beispiele angelegt`) })}>
                {seedMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Beispiele laden
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={expenses.length === 0} onClick={exportCsv}>
              CSV-Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Wird geladen …</p>
          ) : expenses.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Noch keine Ausgaben erfasst.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Lieferant</TableHead>
                    <TableHead className="text-right">Brutto</TableHead>
                    <TableHead className="text-right">USt</TableHead>
                    <TableHead className="text-right">Vorsteuer</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDatum(e.datum)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{e.kategorie}</Badge>
                        {e.belegDokumentId && (
                          <Paperclip className="ml-1 inline h-3 w-3 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{e.lieferant || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{EUR(e.betragBrutto)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {e.ustSatz}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {EUR(enthalteneVorsteuer(e))}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            delMut.mutate(e.id, {
                              onSuccess: () => toast.success("Ausgabe gelöscht"),
                              onError: (err) => toast.error(String(err)),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {open && <AusgabeDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function AusgabeDialog({ onClose }: { onClose: () => void }) {
  const { name } = useAuth();
  const vehicles = useVehicles().data ?? [];
  const drivers = useDrivers().data ?? [];
  const createMut = useCreateExpense();
  const uploadMut = useUploadDocument();

  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [kategorie, setKategorie] = useState<AusgabeKategorie>("Kraftstoff");
  const [lieferant, setLieferant] = useState("");
  const [betrag, setBetrag] = useState("");
  const [ustSatz, setUstSatz] = useState("19");
  const [fahrzeugId, setFahrzeugId] = useState("");
  const [fahrerId, setFahrerId] = useState("");
  const [notiz, setNotiz] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const busy = createMut.isPending || uploadMut.isPending;

  async function submit() {
    const betragNum = Number(betrag.replace(",", "."));
    if (!betragNum || betragNum <= 0) {
      toast.error("Bitte einen gültigen Bruttobetrag eingeben.");
      return;
    }
    let belegDokumentId: string | null = null;
    try {
      if (file) {
        const doc = await uploadMut.mutateAsync({
          file,
          kategorie: "wartungsbeleg",
          ordner: "Belege",
          tags: ["Ausgabe", kategorie],
          hochgeladenVon: name,
        });
        belegDokumentId = doc.id;
      }
      const values: AusgabeWrite = {
        datum,
        kategorie,
        lieferant: lieferant.trim(),
        betragBrutto: Math.round(betragNum * 100) / 100,
        ustSatz: Number(ustSatz) || 0,
        fahrzeugId: fahrzeugId || null,
        fahrerId: fahrerId || null,
        notiz: notiz.trim() || null,
        belegDokumentId,
      };
      await createMut.mutateAsync(values);
      toast.success("Ausgabe gespeichert");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    }
  }

  const betragNum = Number(betrag.replace(",", ".")) || 0;
  const preview = { betragBrutto: betragNum, ustSatz: Number(ustSatz) || 0 };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ausgabe erfassen</DialogTitle>
          <DialogDescription>Beleg mit Foto, Kategorie und USt-Satz erfassen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Datum</Label>
              <Input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Select value={kategorie} onValueChange={(v) => setKategorie(v as AusgabeKategorie)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUSGABE_KATEGORIEN.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Lieferant / Beschreibung</Label>
            <Input value={lieferant} onChange={(e) => setLieferant(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Bruttobetrag (EUR)</Label>
              <Input inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} placeholder="z. B. 118,40" />
            </div>
            <div className="space-y-1.5">
              <Label>USt-Satz auf Beleg (%)</Label>
              <Select value={ustSatz} onValueChange={setUstSatz}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="19">19 %</SelectItem>
                  <SelectItem value="7">7 %</SelectItem>
                  <SelectItem value="0">0 %</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {betragNum > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              Netto {EUR(nettoBetrag(preview))} · enthaltene Vorsteuer{" "}
              {EUR(enthalteneVorsteuer(preview))}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fahrzeug (optional)</Label>
              <Select value={fahrzeugId || "__none__"} onValueChange={(v) => setFahrzeugId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.kennzeichen}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fahrer (optional)</Label>
              <Select value={fahrerId || "__none__"} onValueChange={(v) => setFahrerId(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Belegfoto / -datei (optional)</Label>
            <Input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notiz</Label>
            <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
