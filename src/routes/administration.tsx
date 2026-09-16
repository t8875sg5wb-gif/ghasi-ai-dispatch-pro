import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ShieldUser,
  Users,
  ShieldCheck,
  Activity,
  Database,
  ServerCog,
  Lock,
  Search,
  Plus,
  X,
  Loader2,
  Download,
  UploadCloud,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";

import { exportAllData } from "@/lib/backup.functions";
import { downloadBackupZip } from "@/lib/backup-zip";
import { parseCompleteRestoreZip, type ParsedRestoreZip } from "@/lib/backup-restore-zip";
import { cancelRestore, executeRestore, prepareRestore } from "@/lib/backup-restore.functions";
import { uploadRestoreStagingFiles } from "@/lib/backup-restore-client";
import { supabase } from "@/integrations/supabase/client";

import { listeBenutzer, setzeRolle, type BenutzerEintrag } from "@/lib/admin.functions";
import { ROLE_LABELS, ROLE_BESCHREIBUNG, ROLE_BEREICHE, type AppRole } from "@/lib/roles";
import { logActivity } from "@/lib/protokoll";
import { useAuth } from "@/hooks/use-auth";
import { AblehnungenWidget } from "@/components/dashboard/ablehnungen-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/administration")({
  head: () => ({
    meta: [
      { title: "Administration – GHASI AI" },
      {
        name: "description",
        content: "Benutzer, Rollen, Rechte und Systemkonfiguration verwalten.",
      },
      { property: "og:title", content: "Administration – GHASI AI" },
      {
        property: "og:description",
        content: "Benutzer, Rollen, Rechte und Systemkonfiguration verwalten.",
      },
    ],
  }),
  component: AdministrationSeite,
});

const ALLE_ROLLEN: AppRole[] = ["admin", "disposition", "finanz", "fahrer"];

function AdministrationSeite() {
  const { role } = useAuth();
  const istAdmin = role === "admin";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldUser className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Administration</h1>
          <p className="text-sm text-muted-foreground">
            Benutzer, Rollen & Rechte, Audit-Log und Systemstatus.
          </p>
        </div>
      </div>

      {!istAdmin ? (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-8">
            <Lock className="h-6 w-6 text-warning" />
            <div>
              <p className="font-semibold">Kein Zugriff</p>
              <p className="text-sm text-muted-foreground">
                Die Administration ist Administratoren vorbehalten. Deine Rolle:{" "}
                {role ? ROLE_LABELS[role] : "—"}.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <AblehnungenWidget />
          <Benutzerverwaltung />
          <Rollenmatrix />
          <Datensicherung />
          <SystemStatus />
        </>
      )}
    </div>
  );
}

type RestoreDryRun = {
  planToken: string;
  uploads: Array<{
    finalPath: string;
    stagingPath: string;
    token: string;
    size: number;
    sha256: string;
  }>;
  alreadyPresent: number;
  expiresAt: number;
  snapshotId: string;
  createdAt: string;
  tableCount: number;
  totalRows: number;
  documentCount: number;
};

function Datensicherung() {
  const exportFn = useServerFn(exportAllData);
  const prepareRestoreFn = useServerFn(prepareRestore);
  const executeRestoreFn = useServerFn(executeRestore);
  const cancelRestoreFn = useServerFn(cancelRestore);
  const [busy, setBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [parsedRestore, setParsedRestore] = useState<ParsedRestoreZip | null>(null);
  const [dryRun, setDryRun] = useState<RestoreDryRun | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    try {
      const res = await exportFn();
      const data = JSON.parse(res.json) as Parameters<typeof downloadBackupZip>[0];
      const { tables, rows } = await downloadBackupZip(data, res.snapshotId, res.documentSources);
      if (res.failedTables.length > 0) {
        toast.warning(
          `Backup unvollständig: ${res.failedTables.join(", ")} konnte(n) nicht gesichert werden. Erstellt: ${tables} Tabellen, ${rows} Datensätze.`,
          { duration: 8000 },
        );
      } else {
        toast.success(`Backup erstellt: ${tables} Tabellen, ${rows} Datensätze`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  }

  async function handlePrepareRestore() {
    if (!restoreFile) return toast.error("Bitte zuerst ein GHASI-Backup-ZIP auswählen.");
    setRestoreBusy(true);
    setRestoreResult(null);
    try {
      const parsed = await parseCompleteRestoreZip(restoreFile);
      const prepared = (await prepareRestoreFn({
        data: {
          backupJson: JSON.stringify(parsed.backup),
          documentManifest: parsed.documentManifest,
        },
      })) as RestoreDryRun;
      setParsedRestore(parsed);
      setDryRun(prepared);
      setConfirmation("");
      toast.success("Restore-Dry-Run erfolgreich. Noch wurden keine Daten verändert.");
    } catch (e) {
      setParsedRestore(null);
      setDryRun(null);
      toast.error(e instanceof Error ? e.message : "Restore-Prüfung fehlgeschlagen");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function handleCancelRestore() {
    if (dryRun) {
      try {
        await cancelRestoreFn({ data: { planToken: dryRun.planToken } });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Restore-Plan konnte nicht bereinigt werden");
        return;
      }
    }
    setParsedRestore(null);
    setDryRun(null);
    setConfirmation("");
    setProgress(null);
  }

  async function handleExecuteRestore() {
    if (!parsedRestore || !dryRun) return;
    if (confirmation.trim() !== "WIEDERHERSTELLEN") {
      return toast.error("Bitte zur Bestätigung exakt „WIEDERHERSTELLEN“ eingeben.");
    }
    setRestoreBusy(true);
    try {
      await uploadRestoreStagingFiles(
        parsedRestore.files,
        dryRun.uploads,
        supabase,
        ({ completed, total, currentPath }) =>
          setProgress(`Dokumente: ${completed}/${total} – ${currentPath}`),
      );
      setProgress("Dokumente geprüft. Datenbank wird atomar wiederhergestellt …");
      const result = await executeRestoreFn({
        data: {
          backupJson: JSON.stringify(parsedRestore.backup),
          documentManifest: parsedRestore.documentManifest,
          planToken: dryRun.planToken,
        },
      });
      const message = `${result.tableCount} Tabellen, ${result.totalRows} Datensätze, ${result.documentsRestored} neue Dokumentdateien wiederhergestellt.`;
      setRestoreResult(message);
      if (result.cleanupWarning) toast.warning(result.cleanupWarning, { duration: 8000 });
      else toast.success(`Restore abgeschlossen: ${message}`);
      setParsedRestore(null);
      setDryRun(null);
      setRestoreFile(null);
      setConfirmation("");
      setProgress(null);
    } catch (e) {
      try {
        await cancelRestoreFn({ data: { planToken: dryRun.planToken } });
      } catch {
        // Der urspruengliche Restore-Fehler bleibt fuer den Admin sichtbar.
      }
      toast.error(e instanceof Error ? e.message : "Restore fehlgeschlagen", { duration: 10000 });
    } finally {
      setRestoreBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4" /> Datensicherung & Wiederherstellung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Exportiert die vollständige Datenbank und alle aktiven Dokumentdateien als geprüftes
            ZIP-Archiv.
          </p>
          <Button onClick={handleExport} disabled={busy || restoreBusy} className="shrink-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Backup exportieren
          </Button>
        </div>

        <div className="border-t pt-5">
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm">
              <span className="font-semibold">Restore ersetzt den aktuellen Datenbestand.</span>{" "}
              Zuerst wird nur geprüft. Daten und Dokumente werden erst nach der zweiten,
              ausdrücklichen Bestätigung verändert.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label htmlFor="restore-backup" className="text-sm font-medium">
                GHASI-Backup-ZIP
              </label>
              <Input
                id="restore-backup"
                type="file"
                accept=".zip,application/zip"
                disabled={restoreBusy || Boolean(dryRun)}
                onChange={(e) => {
                  setRestoreFile(e.target.files?.[0] ?? null);
                  setRestoreResult(null);
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!restoreFile || restoreBusy || Boolean(dryRun)}
              onClick={handlePrepareRestore}
            >
              {restoreBusy && !dryRun ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Backup prüfen
            </Button>
          </div>

          {dryRun && parsedRestore && (
            <div className="mt-4 space-y-4 rounded-lg border p-4">
              <div>
                <p className="font-semibold">Dry-Run erfolgreich – noch nichts verändert</p>
                <p className="text-xs text-muted-foreground">
                  Snapshot {dryRun.snapshotId} · Backup vom{" "}
                  {new Date(dryRun.createdAt).toLocaleString("de-DE")}
                </p>
              </div>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Tabellen:</span> {dryRun.tableCount}
                </div>
                <div>
                  <span className="text-muted-foreground">Datensätze:</span> {dryRun.totalRows}
                </div>
                <div>
                  <span className="text-muted-foreground">Dokumente:</span> {dryRun.documentCount}
                </div>
                <div>
                  <span className="text-muted-foreground">Neu hochzuladen:</span>{" "}
                  {dryRun.uploads.length}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {dryRun.alreadyPresent} Dokumentdatei(en) existieren bereits hashgleich. Der
                Restore-Plan läuft um {new Date(dryRun.expiresAt).toLocaleTimeString("de-DE")} ab.
              </p>
              <div className="space-y-1.5">
                <label htmlFor="restore-confirmation" className="text-sm font-medium">
                  Zur Bestätigung WIEDERHERSTELLEN eingeben
                </label>
                <Input
                  id="restore-confirmation"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  disabled={restoreBusy}
                  autoComplete="off"
                />
              </div>
              {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={restoreBusy || confirmation.trim() !== "WIEDERHERSTELLEN"}
                  onClick={handleExecuteRestore}
                >
                  {restoreBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Jetzt wiederherstellen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={restoreBusy}
                  onClick={handleCancelRestore}
                >
                  Prüfung verwerfen
                </Button>
              </div>
            </div>
          )}

          {restoreResult && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
              <p className="font-semibold">Restore erfolgreich abgeschlossen</p>
              <p className="text-muted-foreground">{restoreResult}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                onClick={() => window.location.reload()}
              >
                Ansicht neu laden
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Benutzerverwaltung() {
  const qc = useQueryClient();
  const { name: akteur } = useAuth();
  const ladeBenutzer = useServerFn(listeBenutzer);
  const rolleAendern = useServerFn(setzeRolle);
  const [suche, setSuche] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "benutzer"],
    queryFn: () => ladeBenutzer(),
  });

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; role: AppRole; aktion: "hinzufuegen" | "entfernen" }) =>
      rolleAendern({ data: vars }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["admin", "benutzer"] });
      logActivity({
        bereich: "Administration",
        aktion: vars.aktion === "hinzufuegen" ? "Rolle vergeben" : "Rolle entzogen",
        beschreibung: `Rolle „${ROLE_LABELS[vars.role]}“ wurde ${vars.aktion === "hinzufuegen" ? "vergeben" : "entzogen"}.`,
        akteur,
      });
      toast.success("Rollen aktualisiert");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Aktion fehlgeschlagen"),
  });

  const benutzer = (data ?? []).filter((b) => {
    const q = suche.trim().toLowerCase();
    if (!q) return true;
    return b.name.toLowerCase().includes(q) || b.email.toLowerCase().includes(q);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Benutzerverwaltung
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Benutzer suchen…"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Benutzer konnten nicht geladen werden."}
          </p>
        )}

        {!isLoading &&
          benutzer.map((b) => (
            <BenutzerZeile
              key={b.id}
              benutzer={b}
              busy={mutation.isPending}
              onAdd={(r) => mutation.mutate({ userId: b.id, role: r, aktion: "hinzufuegen" })}
              onRemove={(r) => mutation.mutate({ userId: b.id, role: r, aktion: "entfernen" })}
            />
          ))}
        {!isLoading && benutzer.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine Benutzer gefunden.</p>
        )}
      </CardContent>
    </Card>
  );
}

function BenutzerZeile({
  benutzer,
  busy,
  onAdd,
  onRemove,
}: {
  benutzer: BenutzerEintrag;
  busy: boolean;
  onAdd: (r: AppRole) => void;
  onRemove: (r: AppRole) => void;
}) {
  const offen = ALLE_ROLLEN.filter((r) => !benutzer.rollen.includes(r));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
      <div className="min-w-0">
        <p className="font-medium">{benutzer.name}</p>
        <p className="truncate text-xs text-muted-foreground">{benutzer.email}</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {benutzer.rollen.length === 0 && (
          <span className="text-xs text-muted-foreground">Keine Rolle</span>
        )}
        {benutzer.rollen.map((r) => (
          <Badge key={r} variant="secondary" className="gap-1">
            {ROLE_LABELS[r]}
            <button
              disabled={busy}
              onClick={() => onRemove(r)}
              className="ml-0.5 rounded-full hover:text-destructive disabled:opacity-50"
              aria-label={`Rolle ${ROLE_LABELS[r]} entfernen`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {offen.length > 0 && (
          <Select onValueChange={(v) => onAdd(v as AppRole)} disabled={busy} value="">
            <SelectTrigger className="h-8 w-auto gap-1 border-dashed text-xs">
              <Plus className="h-3.5 w-3.5" />
              <SelectValue placeholder="Rolle" />
            </SelectTrigger>
            <SelectContent>
              {offen.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

function Rollenmatrix() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" /> Rollen & Rechte
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {ALLE_ROLLEN.map((r) => (
          <div key={r} className="rounded-xl border border-border/70 p-3">
            <p className="font-medium">{ROLE_LABELS[r]}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{ROLE_BESCHREIBUNG[r]}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {ROLE_BEREICHE[r].map((b) => (
                <Badge key={b} variant="outline" className="text-[10px] capitalize">
                  {b}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SystemStatus() {
  // Echte, leichte Health-Checks statt fest verdrahteter "grün"-Anzeige.
  const ladeBenutzer = useServerFn(listeBenutzer);
  const dbCheck = useQuery({
    queryKey: ["admin", "systemstatus", "db"],
    queryFn: () => ladeBenutzer(),
    retry: 0,
    staleTime: 30_000,
  });
  const { user } = useAuth();

  const dbOk = !dbCheck.isError;
  const dbPending = dbCheck.isLoading;
  const authOk = Boolean(user);

  const status: { label: string; wert: string; ok: boolean; pending?: boolean }[] = [
    {
      label: "Datenbank",
      wert: dbPending ? "Prüfe…" : dbOk ? "Verbunden" : "Nicht erreichbar",
      ok: dbOk,
      pending: dbPending,
    },
    { label: "Authentifizierung", wert: authOk ? "Aktiv" : "Kein Benutzer", ok: authOk },
    {
      label: "Audit-Log",
      wert: dbPending ? "Prüfe…" : dbOk ? "Aktiv" : "Unbekannt",
      ok: dbOk,
      pending: dbPending,
    },
  ];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ServerCog className="h-4 w-4" /> Systemstatus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {status.map((s) => (
            <div
              key={s.label}
              className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
            >
              <span className="text-sm">{s.label}</span>
              <Badge
                variant="outline"
                className={cn(
                  s.pending
                    ? "border-border bg-muted text-muted-foreground"
                    : s.ok
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-destructive/30 bg-destructive/10 text-destructive",
                )}
              >
                {s.wert}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> Protokolle & Daten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link
            to="/aktivitaeten"
            className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <Activity className="h-4 w-4 text-primary" /> Aktivitätsprotokoll öffnen
          </Link>
          <Link
            to="/verbindungen"
            className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <ServerCog className="h-4 w-4 text-primary" /> Integrationen & API-Zugänge
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
