import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Database,
} from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { parseSpreadsheet } from "@/lib/import-parse";
import { ENTITY_CONFIGS, autoMap, type ImportEntity } from "@/lib/import-config";
import { useCreateDriver } from "@/lib/drivers-store";
import { useCreateVehicle } from "@/lib/vehicles-store";
import { useCreateCustomer } from "@/lib/customers-store";
import { useCreatePatient } from "@/lib/patients-store";
import { logActivity } from "@/lib/protokoll";

export const Route = createFileRoute("/datenimport")({
  head: () => ({
    meta: [
      { title: "Datenimport – GHASI AI" },
      {
        name: "description",
        content: "Fahrer, Fahrzeuge, Kunden und Patienten per CSV oder Excel importieren.",
      },
    ],
  }),
  component: DatenimportPage,
});

type Step = "upload" | "map" | "preview" | "done";
const NONE = "__none__";

interface RowResult {
  index: number;
  record: Record<string, unknown> | null;
  errors: string[];
}

function DatenimportPage() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [entity, setEntity] = useState<ImportEntity>("drivers");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);

  const createDriver = useCreateDriver();
  const createVehicle = useCreateVehicle();
  const createCustomer = useCreateCustomer();
  const createPatient = useCreatePatient();

  const cfg = ENTITY_CONFIGS[entity];

  const creators: Record<ImportEntity, (v: Record<string, unknown>) => Promise<unknown>> = {
    drivers: (v) => createDriver.mutateAsync(v as never),
    vehicles: (v) => createVehicle.mutateAsync(v as never),
    customers: (v) => createCustomer.mutateAsync(v as never),
    patients: (v) => createPatient.mutateAsync(v as never),
  };

  async function handleFile(file: File) {
    try {
      const parsed = await parseSpreadsheet(file);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast.error("Keine Daten gefunden", {
          description: "Die Datei muss eine Kopfzeile und mindestens eine Datenzeile enthalten.",
        });
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(autoMap(entity, parsed.headers));
      setStep("map");
    } catch (e) {
      toast.error("Datei konnte nicht gelesen werden", { description: String(e) });
    }
  }

  // Build the mapped preview rows against the current column mapping.
  const preview = useMemo<RowResult[]>(() => {
    if (step !== "preview" && step !== "map") return [];
    return rows.map((row, index) => {
      const mapped: Record<string, string> = {};
      for (const field of cfg.fields) {
        const col = mapping[field.key];
        mapped[field.key] = col && col !== NONE ? (row[col] ?? "") : "";
      }
      const { record, errors } = cfg.build(mapped);
      return { index, record, errors };
    });
  }, [rows, mapping, cfg, step]);

  const validCount = preview.filter((r) => r.record).length;
  const errorCount = preview.length - validCount;
  const requiredUnmapped = cfg.fields.filter(
    (f) => f.required && (!mapping[f.key] || mapping[f.key] === NONE),
  );

  function resetAll() {
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function runImport() {
    const valid = preview.filter((r) => r.record);
    if (valid.length === 0) return;
    setImporting(true);
    let ok = 0;
    let failed = 0;
    const create = creators[entity];
    for (const r of valid) {
      try {
        await create(r.record as Record<string, unknown>);
        ok++;
      } catch {
        failed++;
      }
    }
    setImporting(false);
    setResult({ ok, failed });
    setStep("done");
    logActivity({
      bereich: "Datenimport",
      aktion: "Import",
      beschreibung: `${ok} ${cfg.label} importiert${failed ? `, ${failed} fehlgeschlagen` : ""} (Datei: ${fileName})`,
    });
    if (failed === 0) toast.success(`${ok} ${cfg.label} importiert`);
    else toast.warning(`${ok} importiert, ${failed} fehlgeschlagen`);
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Datenimport"
        description="Fahrer, Fahrzeuge, Kunden und Patienten per CSV oder Excel (XLSX) übernehmen – mit Spaltenzuordnung, Prüfvorschau und Bestätigung. Angelegt wird über die regulären, geprüften Serverfunktionen."
        icon={Database}
        badge="Bulk-Import"
      />

      <Stepper step={step} />

      {step === "upload" && (
        <Card className="border-border/70 shadow-card">
          <CardHeader>
            <CardTitle className="text-base">1. Datentyp & Datei wählen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2 sm:max-w-xs">
              <Label>Was möchten Sie importieren?</Label>
              <Select value={entity} onValueChange={(v) => setEntity(v as ImportEntity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ENTITY_CONFIGS) as ImportEntity[]).map((e) => (
                    <SelectItem key={e} value={e}>
                      {ENTITY_CONFIGS[e].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{cfg.description}</p>
            </div>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">CSV- oder Excel-Datei hochladen</p>
              <p className="text-xs text-muted-foreground">
                Erste Zeile = Spaltenüberschriften. Formate: .csv, .xlsx, .xls
              </p>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />

            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-xs font-medium text-muted-foreground">
                Erwartete Felder für {cfg.label}:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {cfg.fields.map((f) => (
                  <Badge key={f.key} variant="outline" className="text-[10px]">
                    {f.label}
                    {f.required && <span className="ml-1 text-destructive">*</span>}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "map" && (
        <Card className="border-border/70 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">2. Spalten zuordnen</CardTitle>
            <Badge variant="secondary" className="gap-1">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              {fileName} · {rows.length} Zeilen
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ordnen Sie jede Spalte Ihrer Datei dem passenden Feld zu. Nicht benötigte Felder
              können auf „—" bleiben.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {cfg.fields.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label className="flex items-center gap-1">
                    {f.label}
                    {f.required && <span className="text-destructive">*</span>}
                    {f.hint && (
                      <span className="text-xs font-normal text-muted-foreground">({f.hint})</span>
                    )}
                  </Label>
                  <Select
                    value={mapping[f.key] ?? NONE}
                    onValueChange={(v) =>
                      setMapping((prev) => ({ ...prev, [f.key]: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— nicht importieren —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {requiredUnmapped.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Pflichtfeld noch nicht zugeordnet: {requiredUnmapped.map((f) => f.label).join(", ")}
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" onClick={resetAll}>
                <ArrowLeft className="h-4 w-4" /> Zurück
              </Button>
              <Button onClick={() => setStep("preview")} disabled={requiredUnmapped.length > 0}>
                Weiter zur Vorschau <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card className="border-border/70 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">3. Vorschau & Prüfung</CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                {validCount} gültig
              </Badge>
              {errorCount > 0 && (
                <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                  {errorCount} mit Fehler
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[420px] overflow-auto rounded-xl border border-border/60">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Status</TableHead>
                    {cfg.fields.map((f) => (
                      <TableHead key={f.key}>{f.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r) => {
                    const row = rows[r.index];
                    return (
                      <TableRow key={r.index} className={cn(!r.record && "bg-destructive/5")}>
                        <TableCell className="text-xs text-muted-foreground">{r.index + 1}</TableCell>
                        <TableCell>
                          {r.record ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <span
                              className="flex items-center gap-1 text-xs text-destructive"
                              title={r.errors.join(", ")}
                            >
                              <AlertTriangle className="h-4 w-4" />
                              {r.errors.join(", ")}
                            </span>
                          )}
                        </TableCell>
                        {cfg.fields.map((f) => {
                          const col = mapping[f.key];
                          const val = col && col !== NONE ? (row[col] ?? "") : "";
                          return (
                            <TableCell key={f.key} className="max-w-[160px] truncate text-xs">
                              {val || <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {errorCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Zeilen mit Fehlern werden übersprungen. Es werden {validCount} Datensätze angelegt.
              </p>
            )}

            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="outline" onClick={() => setStep("map")} disabled={importing}>
                <ArrowLeft className="h-4 w-4" /> Zuordnung ändern
              </Button>
              <Button onClick={runImport} disabled={importing || validCount === 0}>
                {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                {validCount} {cfg.label} importieren
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && result && (
        <Card className="border-border/70 shadow-card">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-success/15 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="text-lg font-semibold">Import abgeschlossen</p>
            <p className="text-sm text-muted-foreground">
              {result.ok} {cfg.label} erfolgreich angelegt
              {result.failed > 0 && `, ${result.failed} fehlgeschlagen`}.
            </p>
            <Button onClick={resetAll} className="mt-2">
              Weiteren Import starten
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Datei" },
  { id: "map", label: "Zuordnung" },
  { id: "preview", label: "Vorschau" },
  { id: "done", label: "Fertig" },
];

function Stepper({ step }: { step: Step }) {
  const activeIdx = STEPS.findIndex((s) => s.id === step);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
              i <= activeIdx
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
          <span className={cn("text-sm", i === activeIdx ? "font-semibold" : "text-muted-foreground")}>
            {s.label}
          </span>
          {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}
