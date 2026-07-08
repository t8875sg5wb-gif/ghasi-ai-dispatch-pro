import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckSquare, CalendarClock, Calculator, Archive, FileText } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useInvoices } from "@/lib/invoices-store";
import { useExpenses } from "@/lib/expenses-store";
import { useCompanySettings } from "@/lib/company-settings-store";
import { EUR2 } from "@/lib/finance";
import { computeEuer, verfuegbareJahre } from "@/lib/euer";
import {
  computeGewerbesteuer,
  computeEinkommensteuer,
  computeSoli,
  STEUER_DISCLAIMER,
  GEWST_FREIBETRAG,
} from "@/lib/steuer";

export const Route = createFileRoute("/jahresabschluss")({
  head: () => ({
    meta: [
      { title: "Jahresabschluss – GHASI AI" },
      { name: "description", content: "Steuerschätzung, Fristen und Jahresabschluss-Checkliste." },
    ],
  }),
  component: JahresabschlussPage,
});

const AUFBEWAHRUNG = [
  { was: "Rechnungen & Belege", jahre: "8 Jahre", basis: "§147 AO (seit 2025 verkürzt)" },
  { was: "Bücher & Aufzeichnungen", jahre: "10 Jahre", basis: "§147 AO" },
  { was: "Lohnkonten", jahre: "6 Jahre", basis: "§41 EStG" },
  { was: "Arbeitszeitnachweise", jahre: "2 Jahre", basis: "§16 ArbZG / MiLoG" },
];

function JahresabschlussPage() {
  const { data: invoices } = useInvoices();
  const { data: expenses } = useExpenses();
  const { data: company } = useCompanySettings();

  const rechnungen = invoices ?? [];
  const ausgaben = expenses ?? [];

  const jahre = useMemo(() => verfuegbareJahre(rechnungen, ausgaben), [rechnungen, ausgaben]);
  const [jahr, setJahr] = useState(() => new Date().getFullYear() - 1);

  const euer = useMemo(() => computeEuer(jahr, rechnungen, ausgaben), [jahr, rechnungen, ausgaben]);
  const gewinn = euer.gewinn;

  const gewst = computeGewerbesteuer(gewinn, company.gewerbesteuerHebesatz);
  // §35 EStG: Gewerbesteuer wird pauschal (3,8-fache des Messbetrags) auf die ESt angerechnet.
  const est = computeEinkommensteuer(gewinn);
  const soli = computeSoli(est);

  const heuteJahr = new Date().getFullYear();
  const estFrist = `31.07.${jahr + 1}`;

  const checkliste = [
    {
      titel: "Einkommensteuererklärung inkl. Anlage EÜR",
      frist: `${estFrist} (mit Steuerberater i. d. R. später)`,
      status: heuteJahr > jahr ? "faellig" : "vorbereitung",
      schritte: [
        "Öffnen Sie ELSTER → Formular „Anlage EÜR“ und übertragen Sie diese Werte:",
        `Betriebseinnahmen umsatzsteuerfrei (§4 Nr.17b): ${EUR2(euer.einnahmen.find((z) => z.key === "steuerfrei_4_17b")?.summe ?? 0)}`,
        `Betriebseinnahmen steuerpflichtig: ${EUR2(euer.einnahmen.find((z) => z.key === "andere")?.summe ?? 0)}`,
        `Summe Betriebsausgaben: ${EUR2(euer.ausgabenSumme)}`,
        `Gewinn/Verlust: ${EUR2(gewinn)}`,
      ],
    },
    {
      titel: "Gewerbesteuererklärung",
      frist: estFrist,
      status: gewinn > GEWST_FREIBETRAG ? "faellig" : "entfaellt",
      schritte: [
        `Gewinn ${EUR2(gewinn)} − Freibetrag ${EUR2(GEWST_FREIBETRAG)} × Messzahl 3,5 % × Hebesatz ${company.gewerbesteuerHebesatz} % (Minden).`,
        `Geschätzte Gewerbesteuer: ${EUR2(gewst)}.`,
        "Die Gewerbesteuer wird nach §35 EStG (3,8-facher Messbetrag) auf Ihre Einkommensteuer angerechnet – die tatsächliche Mehrbelastung ist dadurch meist gering.",
      ],
    },
    {
      titel: "Umsatzsteuer-Jahreserklärung",
      frist: estFrist,
      status: company.steuerModus === "regulaer_19" ? "faellig" : "hinweis",
      schritte:
        company.steuerModus === "regulaer_19"
          ? ["Regelbesteuerung aktiv – USt-Jahreserklärung und ggf. Voranmeldungen erforderlich."]
          : [
              "Umsatzsteuerbefreit (§4 Nr.17b UStG) bzw. Kleinunternehmer: i. d. R. keine USt-Voranmeldungen.",
              "Eine USt-Jahreserklärung kann dennoch angefordert werden – bitte mit dem Steuerberater klären.",
            ],
    },
  ] as const;

  const statusMeta: Record<string, { label: string; badge: string }> = {
    faellig: { label: "Fällig", badge: "border-warning/30 bg-warning/10 text-warning" },
    vorbereitung: { label: "In Vorbereitung", badge: "border-info/30 bg-info/10 text-info" },
    entfaellt: { label: "Entfällt", badge: "border-success/30 bg-success/10 text-success" },
    hinweis: { label: "Hinweis", badge: "border-border bg-muted text-muted-foreground" },
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Jahresabschluss-Assistent"
        description="Geschätzte Steuern, Fristen und eine Schritt-für-Schritt-Checkliste mit vorbereiteten ELSTER-Werten. Diese Angaben ersetzen keine steuerliche Beratung."
        icon={CheckSquare}
        badge="Steuer"
        right={
          <Select value={String(jahr)} onValueChange={(v) => setJahr(Number(v))}>
            <SelectTrigger className="w-28 border-white/30 bg-white/15 text-primary-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {jahre.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={`Gewinn ${jahr}`} value={EUR2(gewinn)} icon={Calculator} tone="primary" />
        <StatCard label="Einkommensteuer (Schätzung)" value={EUR2(est)} icon={FileText} tone="warning" />
        <StatCard label="Gewerbesteuer (Schätzung)" value={EUR2(gewst)} icon={FileText} tone="info" />
        <StatCard label="Soli (Schätzung)" value={EUR2(soli)} icon={FileText} tone="accent" />
      </section>

      <Card className="border-border/70 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-4 w-4" /> Checkliste & Fristen {jahr}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {checkliste.map((c) => {
            const meta = statusMeta[c.status] ?? statusMeta.hinweis;
            return (
              <div key={c.titel} className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{c.titel}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">
                      Frist: {c.frist}
                    </Badge>
                    <Badge variant="outline" className={`text-[11px] ${meta.badge}`}>
                      {meta.label}
                    </Badge>
                  </div>
                </div>
                <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
                  {c.schritte.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Archive className="h-4 w-4" /> Aufbewahrungsfristen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              {AUFBEWAHRUNG.map((a) => (
                <tr key={a.was} className="border-b border-border/40 last:border-0">
                  <td className="py-2">{a.was}</td>
                  <td className="py-2 font-semibold">{a.jahre}</td>
                  <td className="py-2 text-right text-xs text-muted-foreground">{a.basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
        <span className="font-semibold">Hinweis:</span> Alle Steuerbeträge sind Schätzungen auf Basis
        des EÜR-Gewinns (Grundtarif, ohne weitere Einkünfte, Sonderausgaben oder Vorsorgeaufwendungen).
        {" "}
        {STEUER_DISCLAIMER}
      </div>
    </div>
  );
}
