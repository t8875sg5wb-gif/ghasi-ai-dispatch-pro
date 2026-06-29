import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Settings,
  Building,
  Bell,
  Palette,
  Globe,
  Plug,
  Shield,
  Sun,
  Moon,
  Save,
} from "lucide-react";

import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { logActivity } from "@/lib/protokoll";
import { ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen – GHASI AI" },
      { name: "description", content: "Unternehmensdaten, Benachrichtigungen und Präferenzen." },
    ],
  }),
  component: EinstellungenSeite,
});

const SPEICHER_KEY = "ghasi-einstellungen";

interface Einstellungen {
  firma: string;
  adresse: string;
  telefon: string;
  email: string;
  steuernummer: string;
  benNeueAuftraege: boolean;
  benWartung: boolean;
  benRechnungen: boolean;
  benKiHinweise: boolean;
  sprache: string;
  zeitzone: string;
  waehrung: string;
}

const STANDARD: Einstellungen = {
  firma: "GHASI Krankentransport GmbH",
  adresse: "Musterstr. 1, 10115 Berlin",
  telefon: "030 1234560",
  email: "kontakt@ghasi-transport.de",
  steuernummer: "DE123456789",
  benNeueAuftraege: true,
  benWartung: true,
  benRechnungen: true,
  benKiHinweise: true,
  sprache: "Deutsch",
  zeitzone: "Europe/Berlin",
  waehrung: "EUR",
};

function ladeEinstellungen(): Einstellungen {
  if (typeof window === "undefined") return STANDARD;
  try {
    const raw = window.localStorage.getItem(SPEICHER_KEY);
    return raw ? { ...STANDARD, ...JSON.parse(raw) } : STANDARD;
  } catch {
    return STANDARD;
  }
}

function EinstellungenSeite() {
  const { theme, setTheme } = useTheme();
  const { name: akteur, role } = useAuth();
  const [werte, setWerte] = useState<Einstellungen>(STANDARD);
  const [firmaAdr, setFirmaAdr] = useState<AdresseStruktur>(() => parseAdresse(STANDARD.adresse));

  useEffect(() => {
    const geladen = ladeEinstellungen();
    setWerte(geladen);
    setFirmaAdr(parseAdresse(geladen.adresse));
  }, []);

  function set<K extends keyof Einstellungen>(key: K, value: Einstellungen[K]) {
    setWerte((prev) => ({ ...prev, [key]: value }));
  }


  function speichern() {
    try {
      window.localStorage.setItem(SPEICHER_KEY, JSON.stringify(werte));
      logActivity({
        bereich: "Einstellungen",
        aktion: "gespeichert",
        beschreibung: "Unternehmens- und Präferenzeinstellungen wurden aktualisiert.",
        akteur,
      });
      toast.success("Einstellungen gespeichert");
    } catch {
      toast.error("Speichern fehlgeschlagen");
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Einstellungen</h1>
            <p className="text-sm text-muted-foreground">
              Unternehmensdaten, Benachrichtigungen, Darstellung und Region.
            </p>
          </div>
        </div>
        <Button onClick={speichern}>
          <Save className="mr-1.5 h-4 w-4" /> Speichern
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building className="h-4 w-4" /> Unternehmensdaten
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Feld label="Firmenname">
              <Input value={werte.firma} onChange={(e) => set("firma", e.target.value)} />
            </Feld>
            <Feld label="Adresse">
              <Textarea
                value={werte.adresse}
                onChange={(e) => set("adresse", e.target.value)}
                rows={2}
              />
            </Feld>
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld label="Telefon">
                <Input value={werte.telefon} onChange={(e) => set("telefon", e.target.value)} />
              </Feld>
              <Feld label="E-Mail">
                <Input value={werte.email} onChange={(e) => set("email", e.target.value)} />
              </Feld>
            </div>
            <Feld label="Steuernummer / USt-IdNr.">
              <Input
                value={werte.steuernummer}
                onChange={(e) => set("steuernummer", e.target.value)}
              />
            </Feld>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> Benachrichtigungen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <SchalterZeile
              label="Neue Aufträge"
              beschreibung="Hinweis bei eingehenden Transportaufträgen"
              checked={werte.benNeueAuftraege}
              onChange={(v) => set("benNeueAuftraege", v)}
            />
            <SchalterZeile
              label="Wartung & TÜV"
              beschreibung="Erinnerungen für Fahrzeugwartung und Fristen"
              checked={werte.benWartung}
              onChange={(v) => set("benWartung", v)}
            />
            <SchalterZeile
              label="Rechnungen"
              beschreibung="Hinweis bei offenen und überfälligen Rechnungen"
              checked={werte.benRechnungen}
              onChange={(v) => set("benRechnungen", v)}
            />
            <SchalterZeile
              label="GHASI AI Hinweise"
              beschreibung="Proaktive Empfehlungen des digitalen Geschäftsführers"
              checked={werte.benKiHinweise}
              onChange={(v) => set("benKiHinweise", v)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" /> Darstellung
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Farbschema</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3 text-sm transition-colors",
                  theme === "light"
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/70 hover:bg-muted",
                )}
              >
                <Sun className="h-4 w-4" /> Hell
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3 text-sm transition-colors",
                  theme === "dark"
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/70 hover:bg-muted",
                )}
              >
                <Moon className="h-4 w-4" /> Dunkel
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" /> Sprache & Region
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld label="Sprache">
                <Select value={werte.sprache} onValueChange={(v) => set("sprache", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Deutsch">Deutsch</SelectItem>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Türkçe">Türkçe</SelectItem>
                  </SelectContent>
                </Select>
              </Feld>
              <Feld label="Währung">
                <Select value={werte.waehrung} onValueChange={(v) => set("waehrung", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">Euro (€)</SelectItem>
                    <SelectItem value="CHF">Franken (CHF)</SelectItem>
                  </SelectContent>
                </Select>
              </Feld>
            </div>
            <Feld label="Zeitzone">
              <Select value={werte.zeitzone} onValueChange={(v) => set("zeitzone", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                  <SelectItem value="Europe/Vienna">Europe/Vienna</SelectItem>
                  <SelectItem value="Europe/Zurich">Europe/Zurich</SelectItem>
                </SelectContent>
              </Select>
            </Feld>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plug className="h-4 w-4" /> Integrationen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Verbinde WhatsApp, E-Mail, Telefonie und weitere Dienste.
            </p>
            <Link to="/verbindungen">
              <Button variant="outline" className="mt-3">
                Verbindungen verwalten
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" /> Sicherheit & Konto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-lg border border-border/70 px-3 py-2 text-sm">
              Angemeldet als <strong>{akteur || "—"}</strong>
              {role && (
                <span className="text-muted-foreground"> · Rolle: {ROLE_LABELS[role]}</span>
              )}
            </div>
            <Link to="/administration">
              <Button variant="outline" className="w-full justify-start">
                Benutzer & Rollen verwalten
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SchalterZeile({
  label,
  beschreibung,
  checked,
  onChange,
}: {
  label: string;
  beschreibung: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{beschreibung}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Feld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
