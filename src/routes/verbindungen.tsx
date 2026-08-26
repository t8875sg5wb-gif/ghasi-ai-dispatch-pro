import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Globe,
  MessageCircle,
  Mail,
  Calendar,
  Map,
  Cloud,
  Calculator,
  CheckCircle2,
  Clock,
  Download,
  Search,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getVerbindungsHealth } from "@/lib/verbindungen.functions";
import {
  archiviereMcpAuditJetzt,
  getMcpArchiv,
  getMcpMonitoring,
} from "@/lib/mcp-monitoring.functions";
import {
  csvZeilen,
  MCP_CSV_SPALTEN,
  MCP_STATUS_LABEL,
  MCP_STATUS_WERTE,
} from "@/lib/mcp-monitoring-shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadCsv, toCsv } from "@/lib/export-utils";

export const Route = createFileRoute("/verbindungen")({
  head: () => ({
    meta: [
      { title: "Verbindungen – GHASI AI" },
      {
        name: "description",
        content:
          "Verbundene Dienste für GHASI AI: Web-Zugriff, WhatsApp Business, E-Mail, Kalender, Karten, Cloud und Buchhaltung – modular und optional.",
      },
      { property: "og:title", content: "Verbindungen – GHASI AI" },
      {
        property: "og:description",
        content:
          "Verbundene Dienste für GHASI AI: Web-Zugriff, WhatsApp Business, E-Mail, Kalender, Karten, Cloud und Buchhaltung – modular und optional.",
      },
    ],
  }),
  component: Verbindungen,
});

type Status = "aktiv" | "geplant";

interface Verbindung {
  id: string;
  icon: LucideIcon;
  name: string;
  beschreibung: string;
  status: Status;
}

const verbindungen: Verbindung[] = [
  {
    id: "web-zugriff",
    icon: Globe,
    name: "Web-Zugriff",
    beschreibung:
      "Echtzeit-Internetsuche für News, Wetter, Verkehr, Börse, Spritpreise, Adressen und Fakten – mit Quellenangabe.",
    status: "geplant",
  },
  {
    id: "whatsapp",
    icon: MessageCircle,
    name: "WhatsApp Business",
    beschreibung: "Nachrichten als Entwurf vorbereiten und nach Ihrer Bestätigung versenden.",
    status: "geplant",
  },
  {
    id: "email",
    icon: Mail,
    name: "E-Mail",
    beschreibung: "Eingang lesen, Antworten entwerfen – Versand erst nach Freigabe.",
    status: "geplant",
  },
  {
    id: "kalender",
    icon: Calendar,
    name: "Google Kalender & Outlook",
    beschreibung: "Termine, Touren und Wartungen im Blick behalten und planen.",
    status: "geplant",
  },
  {
    id: "karten",
    icon: Map,
    name: "Google & Apple Maps",
    beschreibung: "Routen, Navigation, Entfernungen und Verkehr für die Tourenplanung.",
    status: "geplant",
  },
  {
    id: "cloud",
    icon: Cloud,
    name: "Cloud-Speicher",
    beschreibung: "Dokumente und Belege zentral ablegen und durchsuchbar machen.",
    status: "geplant",
  },
  {
    id: "buchhaltung",
    icon: Calculator,
    name: "Buchhaltungssoftware",
    beschreibung: "Rechnungen, Belege und Auswertungen automatisch abgleichen.",
    status: "geplant",
  },
];

/** Zusätzliche interne Dienste, die nur im Health-Widget erscheinen. */
const INTERNE_DIENSTE: { id: string; name: string }[] = [
  { id: "ki-dienst", name: "KI-Dienst" },
  { id: "datenbank", name: "Datenbank" },
];

function Verbindungen() {
  const ladeHealth = useServerFn(getVerbindungsHealth);
  const { data: health, isFetching } = useQuery({
    queryKey: ["verbindungen", "health"],
    queryFn: () => ladeHealth(),
    staleTime: 60_000,
  });

  const ladeMcp = useServerFn(getMcpMonitoring);
  const ladeArchiv = useServerFn(getMcpArchiv);
  const archiviere = useServerFn(archiviereMcpAuditJetzt);
  const queryClient = useQueryClient();

  // Archivbereich: nur Admins erhalten Daten (serverseitig geprüft).
  const { data: archiv } = useQuery({
    queryKey: ["mcp", "archiv"],
    queryFn: () => ladeArchiv({ data: { limit: 100 } }),
    staleTime: 60_000,
    retry: false,
  });

  const archivLauf = useMutation({
    mutationFn: () => archiviere(),
    onSuccess: (e) => {
      toast.success(
        e.verschoben === 0
          ? `Keine Einträge älter als ${e.fristMonate} Monate.`
          : `${e.verschoben} Einträge ins Archiv verschoben (Frist: ${e.fristMonate} Monate).`,
      );
      void queryClient.invalidateQueries({ queryKey: ["mcp"] });
    },
    onError: (f: Error) => toast.error(f.message),
  });

  const [mcpFilter, setMcpFilter] = useState({
    suche: "",
    tool: "alle",
    rolle: "alle",
    scope: "alle",
    status: "alle",
    von: "",
    bis: "",
  });
  const setzeFilter = (feld: keyof typeof mcpFilter, wert: string) =>
    setMcpFilter((f) => ({ ...f, [feld]: wert }));
  const filterAktiv =
    mcpFilter.suche !== "" ||
    mcpFilter.von !== "" ||
    mcpFilter.bis !== "" ||
    [mcpFilter.tool, mcpFilter.rolle, mcpFilter.scope, mcpFilter.status].some((v) => v !== "alle");

  // Nur Admins erhalten Daten; für alle anderen bleibt das Widget verborgen.
  const { data: mcp } = useQuery({
    queryKey: ["mcp", "monitoring", mcpFilter],
    queryFn: () =>
      ladeMcp({
        data: {
          limit: 200,
          suche: mcpFilter.suche || undefined,
          tool: mcpFilter.tool,
          rolle: mcpFilter.rolle,
          scope: mcpFilter.scope,
          status: mcpFilter.status as (typeof MCP_STATUS_WERTE)[number] | "alle",
          von: mcpFilter.von || undefined,
          bis: mcpFilter.bis || undefined,
        },
      }),
    staleTime: 30_000,
    retry: false,
  });

  const exportiereMcpCsv = () => {
    if (!mcp || mcp.aufrufe.length === 0) return;
    const csv = toCsv(csvZeilen(mcp.aufrufe), MCP_CSV_SPALTEN);
    downloadCsv(`mcp-audit-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const konfiguriert = (id: string): boolean =>
    health?.dienste.find((d) => d.id === id)?.konfiguriert ?? false;

  // Nur geprüfte Dienste werden dynamisch: bis die echte Antwort da ist bleibt
  // es neutral ("Geplant"), nie optimistisch "Aktiv".
  const eintraege: Verbindung[] = verbindungen.map((v) =>
    konfiguriert(v.id) ? { ...v, status: "aktiv" } : v,
  );

  const healthZeilen = [
    ...verbindungen.map((v) => ({ id: v.id, name: v.name })),
    ...INTERNE_DIENSTE,
  ];

  const geprueftAmText = health
    ? new Date(health.geprueftAm).toLocaleString("de-DE", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "–";

  return (
    <div className="animate-fade-in space-y-6">
      <section>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Verbindungen</h1>
        <p className="text-sm text-muted-foreground">
          Externe Dienste für GHASI AI – modular und jederzeit erweiterbar. Verbindungen sind
          optional; aktive Dienste nutzt GHASI AI automatisch in der Unterhaltung.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {eintraege.map((v) => (
          <Card
            key={v.name}
            className="border-border/70 shadow-sm transition-all hover:shadow-card"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <v.icon className="h-5 w-5" />
                </span>
                <CardTitle className="text-base">{v.name}</CardTitle>
              </div>
              {v.status === "aktiv" ? (
                <Badge className="gap-1 bg-success/15 text-success hover:bg-success/15">
                  <CheckCircle2 className="h-3 w-3" /> Aktiv
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" /> Geplant
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-snug text-muted-foreground">{v.beschreibung}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section>
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Verbindungs-Health</CardTitle>
            <span className="text-xs text-muted-foreground">
              {isFetching ? "Prüfe …" : `Letzter Check: ${geprueftAmText}`}
            </span>
          </CardHeader>
          <CardContent className="divide-y divide-border/60 p-0">
            {healthZeilen.map((z) => {
              const ok = konfiguriert(z.id);
              return (
                <div
                  key={z.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={`h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-muted-foreground/40"}`}
                    />
                    {z.name}
                  </span>
                  <span className={`text-xs ${ok ? "text-success" : "text-muted-foreground"}`}>
                    {ok ? "Konfiguriert" : "Nicht konfiguriert"}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {mcp && (
        <section>
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">Agenten-Zugriffe (MCP)</CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {mcp.gesamt} Aufrufe · {mcp.erfolge} erfolgreich · {mcp.abgelehnt} abgelehnt ·{" "}
                  {mcp.fehler} Fehler · Ø {mcp.durchschnittMs} ms
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={exportiereMcpCsv}
                  disabled={mcp.aufrufe.length === 0}
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              <div className="grid gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                  <Label htmlFor="mcp-suche" className="text-xs">
                    Suche
                  </Label>
                  <div className="relative">
                    <Search
                      aria-hidden
                      className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
                    />
                    <Input
                      id="mcp-suche"
                      className="pl-8"
                      placeholder="Tool, Scope, Rolle, Client …"
                      value={mcpFilter.suche}
                      onChange={(e) => setzeFilter("suche", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tool</Label>
                  <Select value={mcpFilter.tool} onValueChange={(v) => setzeFilter("tool", v)}>
                    <SelectTrigger aria-label="Tool filtern">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle Tools</SelectItem>
                      {mcp.tools.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Rolle</Label>
                  <Select value={mcpFilter.rolle} onValueChange={(v) => setzeFilter("rolle", v)}>
                    <SelectTrigger aria-label="Rolle filtern">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle Rollen</SelectItem>
                      {mcp.rollen.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Scope</Label>
                  <Select value={mcpFilter.scope} onValueChange={(v) => setzeFilter("scope", v)}>
                    <SelectTrigger aria-label="Scope filtern">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle Scopes</SelectItem>
                      {mcp.scopes.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ergebnisstatus</Label>
                  <Select value={mcpFilter.status} onValueChange={(v) => setzeFilter("status", v)}>
                    <SelectTrigger aria-label="Status filtern">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alle">Alle Ergebnisse</SelectItem>
                      {MCP_STATUS_WERTE.map((s) => (
                        <SelectItem key={s} value={s}>
                          {MCP_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="mcp-von" className="text-xs">
                      Von
                    </Label>
                    <Input
                      id="mcp-von"
                      type="date"
                      value={mcpFilter.von}
                      onChange={(e) => setzeFilter("von", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mcp-bis" className="text-xs">
                      Bis
                    </Label>
                    <Input
                      id="mcp-bis"
                      type="date"
                      value={mcpFilter.bis}
                      onChange={(e) => setzeFilter("bis", e.target.value)}
                    />
                  </div>
                </div>
              </div>
              {mcp.aufrufe.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">
                  {filterAktiv
                    ? "Keine Einträge für die gewählten Filter."
                    : "Noch keine Werkzeug-Ausführungen protokolliert."}
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {mcp.aufrufe.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className={`h-2 w-2 rounded-full ${
                            a.status === "erfolg"
                              ? "bg-success"
                              : a.status === "abgelehnt"
                                ? "bg-warning"
                                : "bg-destructive"
                          }`}
                        />
                        <span className="font-medium">{a.tool}</span>
                        <span className="text-xs text-muted-foreground">{a.scope ?? "–"}</span>
                      </span>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{a.rolle ?? "ohne Rolle"}</span>
                        <span>{a.dauerMs ?? 0} ms</span>
                        <span>
                          {new Date(a.zeitpunkt).toLocaleString("de-DE", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {archiv && (
        <section>
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Archive aria-hidden className="h-4 w-4 text-muted-foreground" />
                Audit-Archiv (MCP)
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {archiv.gesamt} archiviert · Frist {archiv.fristMonate} Monate
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => archivLauf.mutate()}
                  disabled={archivLauf.isPending}
                >
                  <Archive className="h-3.5 w-3.5" />
                  {archivLauf.isPending ? "Archiviere …" : "Jetzt archivieren"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-0">
              <p className="px-4 text-xs text-muted-foreground">
                Einträge älter als {archiv.fristMonate} Monate werden automatisch täglich in diesen
                Archivbereich verschoben – nie gelöscht, damit der Prüfpfad vollständig bleibt. Die
                Frist ändern Sie unter Einstellungen → Datenschutz. Ältester aktiver Eintrag:{" "}
                {archiv.aeltesterAktiv
                  ? new Date(archiv.aeltesterAktiv).toLocaleString("de-DE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "–"}
                .
              </p>
              {archiv.eintraege.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">
                  Noch keine archivierten Einträge.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {archiv.eintraege.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{a.tool}</span>
                        <span className="text-xs text-muted-foreground">{a.scope ?? "–"}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {MCP_STATUS_LABEL[a.status] ?? a.status}
                        </Badge>
                      </span>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{a.rolle ?? "ohne Rolle"}</span>
                        <span>{a.dauerMs ?? 0} ms</span>
                        <span>
                          {new Date(a.zeitpunkt).toLocaleString("de-DE", { dateStyle: "short" })}
                        </span>
                        <span>
                          archiviert{" "}
                          {new Date(a.archiviertAm).toLocaleString("de-DE", { dateStyle: "short" })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}


      <section>
        <Card className="border-border/70 bg-muted/30 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-info" />
            <p>
              Aus Sicherheitsgründen handelt GHASI AI nie eigenmächtig: Nachrichten, E-Mails und
              Freigaben werden ausschließlich als Entwurf vorbereitet und erst nach Ihrer
              ausdrücklichen Bestätigung ausgeführt.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
