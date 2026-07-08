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
  Landmark,
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
import { AddressFields } from "@/components/forms/address-fields";
import { parseAdresse, formatAdresse, type AdresseStruktur } from "@/lib/address";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCompanySettings, useSaveCompanySettings } from "@/lib/company-settings-store";
import type { CompanySettings } from "@/lib/company-settings.functions";
import {
  STEUER_MODI,
  STEUER_MODUS_LABEL,
  STEUER_HINWEIS,
  STEUER_DISCLAIMER,
  type SteuerModus,
} from "@/lib/steuer";

export const Route = createFileRoute("/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen – GHASI AI" },
      { name: "description", content: "Unternehmensdaten, Steuern, Benachrichtigungen und Präferenzen." },
    ],
  }),
  component: EinstellungenSeite,
});

// UI-Präferenzen (kein Firmenstamm) bleiben lokal im Browser.
const PREF_KEY = "ghasi-praeferenzen";

interface Praeferenzen {
  benNeueAuftraege: boolean;
  benWartung: boolean;
  benRechnungen: boolean;
  benKiHinweise: boolean;
  sprache: string;
  zeitzone: string;
  waehrung: string;
}

const STANDARD_PREF: Praeferenzen = {
  benNeueAuftraege: true,
  benWartung: true,
  benRechnungen: true,
  benKiHinweise: true,
  sprache: "Deutsch",
  zeitzone: "Europe/Berlin",
  waehrung: "EUR",
};

function ladePraeferenzen(): Praeferenzen {
  if (typeof window === "undefined") return STANDARD_PREF;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    return raw ? { ...STANDARD_PREF, ...JSON.parse(raw) } : STANDARD_PREF;
  } catch {
    return STANDARD_PREF;
  }
}

const RECHTSFORMEN = [
  "Einzelunternehmen",
  "GbR",
  "GmbH",
  "UG (haftungsbeschränkt)",
  "OHG",
  "KG",
];

function EinstellungenSeite() {
  const { theme, setTheme } = useTheme();
  const { name: akteur, role } = useAuth();
  const istAdmin = role === "admin";

  const { data: firma } = useCompanySettings();
  const saveFirma = useSaveCompanySettings();

  const [company, setCompany] = useState<CompanySettings>(firma);
  const [firmaAdr, setFirmaAdr] = useState<AdresseStruktur>(() => parseAdresse(firma.adresse));
  const [pref, setPref] = useState<Praeferenzen>(STANDARD_PREF);

  useEffect(() => {
    setCompany(firma);
    setFirmaAdr(parseAdresse(firma.adresse));
  }, [firma]);

  useEffect(() => setPref(ladePraeferenzen()), []);

  function setC<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setCompany((prev) => ({ ...prev, [key]: value }));
  }
  function setP<K extends keyof Praeferenzen>(key: K, value: Praeferenzen[K]) {
    setPref((prev) => ({ ...prev, [key]: value }));
  }

  async function speichern() {
    try {
      window.localStorage.setItem(PREF_KEY, JSON.stringify(pref));
      if (istAdmin) {
        await saveFirma.mutateAsync(company);
      }
      logActivity({
        bereich: "Einstellungen",
        aktion: "gespeichert",
        beschreibung: istAdmin
          ? "Unternehmens-, Steuer- und Präferenzeinstellungen wurden aktualisiert."
          : "Persönliche Präferenzen wurden aktualisiert.",
        akteur,
      });
      toast.success("Einstellungen gespeichert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
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
              Unternehmensdaten, Steuern, Benachrichtigungen und Region.
            </p>
          </div>
        </div>
        <Button onClick={speichern} disabled={saveFirma.isPending}>
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
            {!istAdmin && (
              <p className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                Nur Administratoren können die Unternehmensdaten ändern.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld label="Firmenname">
                <Input
                  value={company.firma}
                  disabled={!istAdmin}
                  onChange={(e) => setC("firma", e.target.value)}
                />
              </Feld>
              <Feld label="Rechtsform">
                <Select
                  value={company.rechtsform}
                  onValueChange={(v) => setC("rechtsform", v)}
                  disabled={!istAdmin}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECHTSFORMEN.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Feld>
            </div>
            <Feld label="Inhaber (bei Einzelunternehmen)">
              <Input
                value={company.inhaber}
                disabled={!istAdmin}
                onChange={(e) => setC("inhaber", e.target.value)}
              />
            </Feld>
            <AddressFields
              idPrefix="firma-adresse"
              label="Adresse"
              value={firmaAdr}
              onChange={(next) => {
                setFirmaAdr(next);
                setC("adresse", formatAdresse(next));
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Feld label="Telefon">
                <Input
                  value={company.telefon}
                  disabled={!istAdmin}
                  onChange={(e) => setC("telefon", e.target.value)}
                />
              </Feld>
              <Feld label="E-Mail">
                <Input
                  value={company.email}
                  disabled={!istAdmin}
                  onChange={(e) => setC("email", e.target.value)}
                />
              </Feld>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Feld label="Steuernummer">
                <Input
                  value={company.steuernummer}
                  disabled={!istAdmin}
                  onChange={(e) => setC("steuernummer", e.target.value)}
                />
              </Feld>
              <Feld label="USt-IdNr. (falls vorhanden)">
                <Input
                  value={company.ustId}
                  disabled={!istAdmin}
                  onChange={(e) => setC("ustId", e.target.value)}
                />
              </Feld>
            </div>
          </CardContent>
        </Card>

        {/* Steuern */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark className="h-4 w-4" /> Steuern
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Feld label="Umsatzsteuer-Modus">
              <Select
                value={company.steuerModus}
                onValueChange={(v) => setC("steuerModus", v as SteuerModus)}
                disabled={!istAdmin}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STEUER_MODI.map((m) => (
                    <SelectItem key={m} value={m}>
                      {STEUER_MODUS_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Feld>
            <p className="rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
              {STEUER_HINWEIS[company.steuerModus]}
            </p>
            <Feld label="Gewerbesteuer-Hebesatz (%)">
              <Input
                type="number"
                inputMode="numeric"
                value={company.gewerbesteuerHebesatz}
                disabled={!istAdmin}
                onChange={(e) => setC("gewerbesteuerHebesatz", Number(e.target.value) || 0)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Referenzwert Minden: 460 %. Grundlage für die Gewinn-nach-Steuern-Schätzung im CEO
                Cockpit.
              </p>
            </Feld>
            <div className="mt-2 rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="mb-3 text-sm font-medium">DATEV-Export (Steuerberater)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Feld label="Berater-Nr.">
                  <Input
                    value={company.datevBeraterNr}
                    disabled={!istAdmin}
                    onChange={(e) => setC("datevBeraterNr", e.target.value)}
                  />
                </Feld>
                <Feld label="Mandanten-Nr.">
                  <Input
                    value={company.datevMandantNr}
                    disabled={!istAdmin}
                    onChange={(e) => setC("datevMandantNr", e.target.value)}
                  />
                </Feld>
                <Feld label="Erlöskonto (SKR03)">
                  <Input
                    value={company.datevErloeskonto}
                    disabled={!istAdmin}
                    onChange={(e) => setC("datevErloeskonto", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Standard 8120: steuerfreie Umsätze §4 Nr.17b.
                  </p>
                </Feld>
                <Feld label="Debitoren-/Gegenkonto">
                  <Input
                    value={company.datevGegenkonto}
                    disabled={!istAdmin}
                    onChange={(e) => setC("datevGegenkonto", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Standard 10000.</p>
                </Feld>
              </div>
            </div>
            <p className="text-xs italic text-muted-foreground">{STEUER_DISCLAIMER}</p>
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
              checked={pref.benNeueAuftraege}
              onChange={(v) => setP("benNeueAuftraege", v)}
            />
            <SchalterZeile
              label="Wartung & TÜV"
              beschreibung="Erinnerungen für Fahrzeugwartung und Fristen"
              checked={pref.benWartung}
              onChange={(v) => setP("benWartung", v)}
            />
            <SchalterZeile
              label="Rechnungen"
              beschreibung="Hinweis bei offenen und überfälligen Rechnungen"
              checked={pref.benRechnungen}
              onChange={(v) => setP("benRechnungen", v)}
            />
            <SchalterZeile
              label="GHASI AI Hinweise"
              beschreibung="Proaktive Empfehlungen des digitalen Geschäftsführers"
              checked={pref.benKiHinweise}
              onChange={(v) => setP("benKiHinweise", v)}
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
                <Select value={pref.sprache} onValueChange={(v) => setP("sprache", v)}>
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
                <Select value={pref.waehrung} onValueChange={(v) => setP("waehrung", v)}>
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
              <Select value={pref.zeitzone} onValueChange={(v) => setP("zeitzone", v)}>
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
              {role && <span className="text-muted-foreground"> · Rolle: {ROLE_LABELS[role]}</span>}
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
