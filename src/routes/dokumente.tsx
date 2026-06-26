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
} from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/protokoll";
import {
  INITIAL_DOKUMENTE,
  KATEGORIE_META,
  FORMAT_META,
  DOKUMENT_KATEGORIEN,
  searchDokumente,
  ordnerStruktur,
  aktuelleVersion,
  formatDatum,
  formatGroesse,
  type DokumentKategorie,
} from "@/lib/documents";

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

function DokumentePage() {
  const [suche, setSuche] = useState("");
  const [kategorie, setKategorie] = useState<DokumentKategorie | "alle">("alle");
  const fileRef = useRef<HTMLInputElement>(null);

  const ergebnisse = useMemo(() => searchDokumente(suche, kategorie), [suche, kategorie]);
  const ordner = useMemo(() => ordnerStruktur(), []);

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    toast.success(`„${f.name}" zum Upload vorgemerkt`, {
      description: "Datei wird klassifiziert und verknüpft (Demo – keine Speicherung).",
    });
    logActivity({
      bereich: "Dokumente",
      aktion: "Upload",
      beschreibung: `Dokument „${f.name}" hochgeladen`,
      entitaet: f.name,
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Dokumentencenter"
        description="Rezepte, Aufträge, Verträge, Rechnungen, Fahrer- & Fahrzeugdokumente – zentral, versioniert, OCR-durchsuchbar und mit jedem Objekt verknüpft."
        icon={FolderArchive}
        badge="Enterprise DMS"
        right={
          <Button
            className="rounded-full"
            variant="secondary"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Hochladen
          </Button>
        }
      />
      <input ref={fileRef} type="file" className="hidden" onChange={onUpload} />

      <div className="grid gap-4 lg:grid-cols-4">
        {/* Ordnerstruktur + Kategorien */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="border-border/70 shadow-card">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0">
              <FolderTree className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Ordner</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
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
            {ergebnisse.map((d) => {
              const kat = KATEGORIE_META[d.kategorie];
              const fmt = FORMAT_META[d.format];
              const ver = aktuelleVersion(d);
              const KatIcon = kat.icon;
              return (
                <div
                  key={d.id}
                  className="flex flex-wrap items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      kat.badge,
                    )}
                  >
                    <KatIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{d.name}</p>
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
                      <Clock className="h-3 w-3" />v{ver.version} · {formatDatum(ver.datum)} ·{" "}
                      {ver.von} · {formatGroesse(ver.groesseKb)}
                      {d.versionen.length > 1 && (
                        <span className="ml-1">· {d.versionen.length} Versionen</span>
                      )}
                    </p>
                  </div>
                  {d.bezug && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="shrink-0 rounded-full text-primary"
                    >
                      <Link to={d.bezug.to}>
                        {d.bezug.label} <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              );
            })}
            {ergebnisse.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Keine Dokumente gefunden.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
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
