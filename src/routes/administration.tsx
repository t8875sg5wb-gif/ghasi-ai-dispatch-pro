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
} from "lucide-react";

import { listeBenutzer, setzeRolle, type BenutzerEintrag } from "@/lib/admin.functions";
import { ROLE_LABELS, ROLE_BESCHREIBUNG, ROLE_BEREICHE, type AppRole } from "@/lib/roles";
import { logActivity } from "@/lib/protokoll";
import { useAuth } from "@/hooks/use-auth";
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
          <Benutzerverwaltung />
          <Rollenmatrix />
          <SystemStatus />
        </>
      )}
    </div>
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
  const status: { label: string; wert: string; ok: boolean }[] = [
    { label: "Datenbank", wert: "Verbunden", ok: true },
    { label: "Authentifizierung", wert: "Aktiv", ok: true },
    { label: "KI-Gateway", wert: "Verfügbar", ok: true },
    { label: "Audit-Log", wert: "Aktiv", ok: true },
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
                  s.ok
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
