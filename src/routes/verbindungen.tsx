import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Globe,
  MessageCircle,
  Mail,
  Calendar,
  Map,
  Cloud,
  Calculator,
  CheckCircle2,
  Clock,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getVerbindungsHealth } from "@/lib/verbindungen.functions";

export const Route = createFileRoute("/verbindungen")({
  head: () => ({
    meta: [
      { title: "Verbindungen – GHASI AI" },
      {
        name: "description",
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
