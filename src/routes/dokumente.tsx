import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  FolderArchive,
  Search,
  Upload,
  FolderTree,
  Clock,
  ArrowRight,
  ScanLine,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/protokoll";
import { useAuth } from "@/hooks/use-auth";
import {
  KATEGORIE_META,
  FORMAT_META,
  DOKUMENT_KATEGORIEN,
  formatDatum,
  formatGroesse,
  type DokumentKategorie,
  type DokumentBezugTyp,
  type DokumentBezug,
} from "@/lib/documents";
import { useDocuments, useUploadDocument, useDeleteDocument } from "@/lib/documents-store";
import { DocumentViewer } from "@/components/dokumente/document-viewer";
import { VerordnungScanDialog } from "@/components/dokumente/verordnung-scan-dialog";
import type { DokumentRecord } from "@/lib/documents-shared";

export const Route = createFileRoute("/dokumente")({
  head: () => ({
    meta: [
      { title: "Dokumente – GHASI AI" },
      {
        name: "description",
        content:
          "Zentrales Dokumentenarchiv: Upload, Vorschau, Versionen, Tags, OCR-Suche und Verknüpfungen.",
      },
    ],
  }),
  component: DokumentePage,
});

const BEZUG_ROUTE: Record<DokumentBezugTyp, string> = {
  patient: "/patienten",
  kunde: "/kunden",
  fahrer: "/fahrer",
  fahrzeug: "/fahrzeuge",
  transport: "/auftraege",
  rechnung: "/rechnungen",
  wartung: "/wartung",
};

const BEZUG_LABEL: Record<DokumentBezugTyp, string> = {
  patient: "Patient",
  kunde: "Kunde",
  fahrer: "Fahrer",
  fahrzeug: "Fahrzeug",
  transport: "Auftrag",
  rechnung: "Rechnung",
  wartung: "Wartung",
};

function DokumentePage() {
  const { name: akteur } = useAuth();
  const [suche, setSuche] = useState("");
  const [kategorie, setKategorie] = useState<DokumentKategorie | "alle">("alle");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewer, setViewer] = useState<DokumentRecord | null>(null);

  const { data: dokumente = [], isLoading, isError, refetch } = useDocuments();
  const deleteMut = useDeleteDocument();

  const ergebnisse = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return dokumente.filter((d) => {
      if (kategorie !== "alle" && d.kategorie !== kategorie) return false;
      if (!q) return true;
      const hay =
        `${d.name} ${d.ordner} ${d.tags.join(" ")} ${d.bezug?.label ?? ""} ${d.ocrText ?? ""}`.toLowerCase();
      return q.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [dokumente, suche, kategorie]);

  const ordner = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dokumente) {
      const top = d.ordner.split("/")[0];
      map.set(top, (map.get(top) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([o, anzahl]) => ({ ordner: o, anzahl }))
      .sort((a, b) => b.anzahl - a.anzahl);
  }, [dokumente]);

  const onDelete = (d: DokumentRecord) => {
    deleteMut.mutate(d.id, {
      onSuccess: () => {
        toast.success(`„${d.name}" gelöscht`);
        logActivity({
          bereich: "Dokumente",
          aktion: "Löschen",
          beschreibung: `Dokument „${d.name}" gelöscht`,
          entitaet: d.name,
        });
      },
      onError: (e) => toast.error("Löschen fehlgeschlagen", { description: String(e) }),
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Dokumentencenter"
        description="Rezepte, Aufträge, Verträge, Rechnungen, Fahrer- & Fahrzeugdokumente – zentral gespeichert, OCR-durchsuchbar und mit jedem Objekt verknüpft."
        icon={FolderArchive}
        badge="Enterprise DMS"
        right={
          <Button className="rounded-full" variant="secondary" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" /> Hochladen
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-4">
        {/* Ordnerstruktur + Kategorien */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="border-border/70 shadow-card">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <FolderTree className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Ordner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {ordner.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">Noch keine Ordner.</p>
              )}
              {ordner.map((o) => (
                <div
                  key={o.ordner}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50"
                >
                  <span className="truncate text-muted-foreground">{o.ordner}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {o.anzahl}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Kategorien</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <CatButton
                active={kategorie === "alle"}
                onClick={() => setKategorie("alle")}
                label="Alle Kategorien"
              />
              {DOKUMENT_KATEGORIEN.map((k) => (
                <CatButton
                  key={k}
                  active={kategorie === k}
                  onClick={() => setKategorie(k)}
                  label={KATEGORIE_META[k].label}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Liste */}
        <Card className="border-border/70 shadow-card lg:col-span-3">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">{ergebnisse.length} Dokumente</CardTitle>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  placeholder="Name, Tag, Inhalt (OCR), Verknüpfung …"
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Dokumente werden geladen …
              </p>
            )}
            {isError && (
              <div className="flex flex-col items-center gap-2 py-8">
                <p className="text-sm text-destructive">Dokumente konnten nicht geladen werden.</p>
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Erneut versuchen
                </Button>
              </div>
            )}
            {!isLoading &&
              ergebnisse.map((d) => {
                const kat = KATEGORIE_META[d.kategorie];
                const fmt = FORMAT_META[d.format];
                const KatIcon = kat.icon;
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                  >
                    <button
                      type="button"
                      onClick={() => setViewer(d)}
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        kat.badge,
                      )}
                      aria-label="Vorschau öffnen"
                    >
                      <KatIcon className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewer(d)}
                          className="truncate text-left text-sm font-medium hover:underline"
                        >
                          {d.name}
                        </button>
                        <Badge variant="outline" className={cn("text-[10px]", kat.badge)}>
                          {kat.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          <fmt.icon className="mr-1 h-3 w-3" />
                          {fmt.label}
                        </Badge>
                        {d.ocrText && (
                          <Badge
                            variant="outline"
                            className="border-success/30 bg-success/10 text-[10px] text-success"
                          >
                            <ScanLine className="mr-1 h-3 w-3" /> OCR
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.ordner}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {d.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDatum(d.hochgeladenAm)} · {d.hochgeladenVon} ·{" "}
                        {formatGroesse(d.groesseKb)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {d.bezug && (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="rounded-full text-primary"
                        >
                          <Link to={d.bezug.to}>
                            {d.bezug.label} <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewer(d)}
                        aria-label="Ansehen"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        disabled={deleteMut.isPending}
                        onClick={() => onDelete(d)}
                        aria-label="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            {!isLoading && !isError && ergebnisse.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {dokumente.length === 0
                    ? "Noch keine Dokumente hochgeladen."
                    : "Keine Dokumente gefunden."}
                </p>
                {dokumente.length === 0 && (
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <Upload className="h-4 w-4" /> Erstes Dokument hochladen
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        akteur={akteur ?? "Mitarbeiter"}
      />
      <DocumentViewer
        dokument={viewer}
        open={viewer !== null}
        onOpenChange={(o) => !o && setViewer(null)}
      />
    </div>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  akteur,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  akteur: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [datei, setDatei] = useState<File | null>(null);
  const [kategorie, setKategorie] = useState<DokumentKategorie>("patientendokument");
  const [ordner, setOrdner] = useState("Allgemein");
  const [tags, setTags] = useState("");
  const [bezugTyp, setBezugTyp] = useState<DokumentBezugTyp | "keine">("keine");
  const [bezugLabel, setBezugLabel] = useState("");
  const uploadMut = useUploadDocument();

  const reset = () => {
    setDatei(null);
    setKategorie("patientendokument");
    setOrdner("Allgemein");
    setTags("");
    setBezugTyp("keine");
    setBezugLabel("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = () => {
    if (!datei) {
      toast.error("Bitte zuerst eine Datei auswählen");
      return;
    }
    const bezug: DokumentBezug | null =
      bezugTyp !== "keine" && bezugLabel.trim()
        ? { typ: bezugTyp, label: bezugLabel.trim(), to: BEZUG_ROUTE[bezugTyp] }
        : null;
    uploadMut.mutate(
      {
        file: datei,
        kategorie,
        ordner: ordner.trim() || "Allgemein",
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        bezug,
        hochgeladenVon: akteur,
      },
      {
        onSuccess: (d) => {
          toast.success(`„${d.name}" gespeichert`);
          logActivity({
            bereich: "Dokumente",
            aktion: "Upload",
            beschreibung: `Dokument „${d.name}" hochgeladen`,
            entitaet: d.name,
          });
          reset();
          onOpenChange(false);
        },
        onError: (e) => toast.error("Upload fehlgeschlagen", { description: String(e) }),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dokument hochladen</DialogTitle>
          <DialogDescription>
            PDF oder Bild in den sicheren Dokumentenspeicher laden und mit einem Objekt verknüpfen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Datei</Label>
            <Input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*,.png,.jpg,.jpeg,.webp,.csv,.xlsx,.xls,.txt"
              onChange={(e) => setDatei(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kategorie</Label>
              <Select value={kategorie} onValueChange={(v) => setKategorie(v as DokumentKategorie)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOKUMENT_KATEGORIEN.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KATEGORIE_META[k].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ordner</Label>
              <Input
                value={ordner}
                onChange={(e) => setOrdner(e.target.value)}
                placeholder="z. B. Patienten/Bauer"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Schlagworte (durch Komma getrennt)</Label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="dialyse, verordnung, aok"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Verknüpfung</Label>
              <Select
                value={bezugTyp}
                onValueChange={(v) => setBezugTyp(v as DokumentBezugTyp | "keine")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keine">Keine</SelectItem>
                  {(Object.keys(BEZUG_LABEL) as DokumentBezugTyp[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {BEZUG_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {bezugTyp !== "keine" && (
              <div className="space-y-1.5">
                <Label>Bezeichnung</Label>
                <Input
                  value={bezugLabel}
                  onChange={(e) => setBezugLabel(e.target.value)}
                  placeholder="z. B. Johann Bauer"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={uploadMut.isPending || !datei}>
            {uploadMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      {label}
    </button>
  );
}
