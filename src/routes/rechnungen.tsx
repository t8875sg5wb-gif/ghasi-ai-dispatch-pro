import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Euro,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Send,
  Copy,
  Download,
  FileDown,
  Loader2,
  Banknote,
} from "lucide-react";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";

import { PageHero } from "@/components/enterprise/page-hero";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  INITIAL_RECHNUNGEN,
  RECHNUNG_STATUS_META,
  RECHNUNG_STATI,
  computeFinanzKpis,
  detectFinanzAnomalien,
  ANOMALIE_META,
  tageUeberfaellig,
  formatDatum,
  EUR,
  netto,
  mwstBetrag,
  brutto,
  type RechnungStatus,
} from "@/lib/finance";
import { STEUER_HINWEIS, STEUER_DISCLAIMER } from "@/lib/steuer";
import {
  useInvoices,
  useSeedInvoices,
  useGenerateBillingDrafts,
  useUpdateInvoice,
} from "@/lib/invoices-store";
import { useOrders } from "@/lib/orders-store";
import { useCompanySettings } from "@/lib/company-settings-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { buildMahnText, naechsteMahnstufe, mahnStufeLabel } from "@/lib/dunning";
import { rechnungToWrite } from "@/lib/invoices-shared";
import { downloadText } from "@/lib/export-utils";
import { RechnungDetailDialog } from "@/components/rechnungen/rechnung-detail-dialog";
import { BankImportDialog } from "@/components/rechnungen/bank-import-dialog";
import { logActivity } from "@/lib/protokoll";
import type { Rechnung, MahnEintrag } from "@/lib/finance";

export const Route = createFileRoute("/rechnungen")({
  head: () => ({
    meta: [
      { title: "Rechnungen – GHASI AI" },
      {
        name: "description",
        content: "Abrechnung, Mahnwesen, offene Posten und KI-Rechnungsprüfung.",
      },
    ],
  }),
  component: RechnungenPage,
});

/** True when an invoice is a normal, still-open, overdue invoice that can be dunned. */
function istMahnbar(r: Rechnung, mounted: boolean): boolean {
  if (!mounted) return false;
  if (r.typ !== "rechnung") return false;
  if (!["offen", "teilbezahlt", "ueberfaellig"].includes(r.status)) return false;
  return tageUeberfaellig(r) > 0;
}


function RechnungenPage() {
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<RechnungStatus | "alle">("alle");
  const [suche, setSuche] = useState("");
  useEffect(() => setMounted(true), []);

  const { data: invoiceData, isLoading, isError, refetch } = useInvoices();
  const { data: orderData } = useOrders();
  const seedMut = useSeedInvoices();
  const draftsMut = useGenerateBillingDrafts();
  const updateMut = useUpdateInvoice();
  const { data: company } = useCompanySettings();

  // Detail-/Zahlungsdialog
  const [detailTarget, setDetailTarget] = useState<Rechnung | null>(null);
  const [bankOpen, setBankOpen] = useState(false);

  // Mahnwesen-Dialog
  const [mahnTarget, setMahnTarget] = useState<Rechnung | null>(null);
  const [mahnText, setMahnText] = useState("");
  const mahnStufe = mahnTarget ? naechsteMahnstufe(mahnTarget) : 0;

  function openMahnung(r: Rechnung) {
    const stufe = naechsteMahnstufe(r);
    setMahnTarget(r);
    setMahnText(buildMahnText(r, stufe, company));
  }

  function markiereMahnungVersendet() {
    if (!mahnTarget) return;
    const stufe = naechsteMahnstufe(mahnTarget);
    const eintrag: MahnEintrag = {
      stufe,
      datum: new Date().toISOString(),
      tageUeberfaellig: tageUeberfaellig(mahnTarget),
    };
    const write = rechnungToWrite(mahnTarget);
    write.mahnstufe = stufe;
    write.letzteMahnung = eintrag.datum;
    write.mahnHistorie = [...(mahnTarget.mahnHistorie ?? []), eintrag];
    updateMut.mutate(
      { id: mahnTarget.id, values: write },
      {
        onSuccess: () => {
          toast.success(`${mahnStufeLabel(stufe)} als versendet vermerkt`);
          logActivity({
            bereich: "Rechnungen",
            entitaet: mahnTarget.nummer,
            aktion: "Mahnung",
            beschreibung: `${mahnStufeLabel(stufe)} für ${mahnTarget.nummer} (${mahnTarget.kunde}) erstellt`,
          });
          setMahnTarget(null);
        },
        onError: (e) => toast.error("Konnte nicht gespeichert werden", { description: String(e) }),
      },
    );
  }

  const alleRechnungen = invoiceData ?? INITIAL_RECHNUNGEN;

  const kpis = useMemo(() => computeFinanzKpis(alleRechnungen), [alleRechnungen]);
  const anomalien = useMemo(
    () => (mounted ? detectFinanzAnomalien(alleRechnungen, orderData ?? []) : []),
    [mounted, alleRechnungen, orderData],
  );

  const rechnungen = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return alleRechnungen.filter((r) => {
      if (filter !== "alle" && r.status !== filter) return false;
      if (!q) return true;
      return `${r.nummer} ${r.kunde} ${r.bezugAuftrag ?? ""}`.toLowerCase().includes(q);
    });
  }, [alleRechnungen, filter, suche]);

  const istLeer = !isLoading && !isError && alleRechnungen.length === 0;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHero
        title="Rechnungen & Mahnwesen"
        description="Abrechnung für Krankenkassen, Patienten und Kunden – inklusive KI-Rechnungsprüfung. GHASI AI versendet niemals automatisch."
        icon={FileText}
        badge="Finanzen"
      />

      {isError && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-destructive">Rechnungen konnten nicht geladen werden.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Rechnungen werden geladen …</p>}

      {istLeer && (
        <Card className="border-border/70 shadow-card">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Noch keine Rechnungen in der Datenbank.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={draftsMut.isPending}
                onClick={() => draftsMut.mutate()}
              >
                Abrechnungs-Entwürfe erstellen
              </Button>
              <Button size="sm" disabled={seedMut.isPending} onClick={() => seedMut.mutate()}>
                Beispieldaten laden
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Offene Posten"
          value={EUR(kpis.offenePosten)}
          icon={Clock}
          tone="info"
          hint={`${kpis.anzahlOffen} Rechnungen`}
        />
        <StatCard
          label="Überfällig"
          value={mounted ? EUR(kpis.ueberfaelligeSumme) : "—"}
          icon={AlertTriangle}
          tone="warning"
          hint={mounted ? `${kpis.anzahlUeberfaellig} überfällig` : "wird geprüft"}
        />
        <StatCard
          label="Bezahlt"
          value={EUR(kpis.bezahltSumme)}
          icon={CheckCircle2}
          tone="success"
          hint={`${kpis.anzahlBezahlt} beglichen`}
        />
        <StatCard
          label="Gutschriften"
          value={EUR(kpis.gutschriftenSumme)}
          icon={Euro}
          tone="accent"
          hint="erstattet"
        />
      </section>

      {/* KI-Rechnungsprüfung */}
      <Card className="border-border/70 shadow-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Sparkles className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">KI-Rechnungsprüfung</CardTitle>
          </div>
          <Badge variant="secondary">{anomalien.length}</Badge>
        </CardHeader>
        <CardContent className="grid gap-2.5 lg:grid-cols-2">
          {!mounted && <p className="text-sm text-muted-foreground">GHASI AI prüft Rechnungen …</p>}
          {mounted && anomalien.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Keine Auffälligkeiten – alle Rechnungen sind konsistent.
            </p>
          )}
          {anomalien.slice(0, 6).map((a) => (
            <Link
              key={a.id}
              to={a.to}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 transition-colors hover:bg-muted/60"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium leading-snug">{a.titel}</p>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", ANOMALIE_META[a.typ].badge)}
                  >
                    {ANOMALIE_META[a.typ].label}
                  </Badge>
                </div>
                <p className="text-xs leading-snug text-muted-foreground">{a.grund}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <span className="font-medium">Quelle:</span> {a.quelle} ·{" "}
                  <span className="font-medium">Wirkung:</span> {a.wirkung} ·{" "}
                  <span className="font-medium">Konfidenz:</span> {a.konfidenz}%
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-accent">
                  Empfehlung: {a.empfehlung}
                </p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Filter + Tabelle */}
      <Card className="border-border/70 shadow-card">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Alle Rechnungen</CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Nummer, Kunde, Auftrag …"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={filter === "alle"} onClick={() => setFilter("alle")}>
              Alle
            </FilterChip>
            {RECHNUNG_STATI.map((s) => (
              <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
                {RECHNUNG_STATUS_META[s].label}
              </FilterChip>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Auftrag</TableHead>
                  <TableHead>Fällig</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                  <TableHead className="text-right">USt</TableHead>
                  <TableHead className="text-right">Brutto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mahnung</TableHead>
                  <TableHead className="text-right">Aktion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rechnungen.map((r) => {
                  const tage = mounted ? tageUeberfaellig(r) : 0;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nummer}</TableCell>
                      <TableCell>
                        <Link
                          to="/kunden"
                          search={{ id: r.kundeId || undefined }}
                          className="text-primary hover:underline"
                        >
                          {r.kunde}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.bezugAuftrag ? (
                          <Link
                            to="/auftraege"
                            search={{ nummer: r.bezugAuftrag }}
                            className="text-primary hover:underline"
                          >
                            {r.bezugAuftrag}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDatum(r.faelligkeit)}
                        {tage > 0 && (
                          <span className="ml-1 text-xs text-destructive">+{tage}T</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{EUR(netto(r))}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {r.mwstSatz > 0 ? `${EUR(mwstBetrag(r))} (${r.mwstSatz} %)` : "0 %"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {EUR(brutto(r))}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", RECHNUNG_STATUS_META[r.status].badge)}
                        >
                          {RECHNUNG_STATUS_META[r.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(r.mahnstufe ?? 0) > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              variant="outline"
                              className="border-warning/30 bg-warning/10 text-[10px] text-warning"
                            >
                              {mahnStufeLabel(r.mahnstufe ?? 0)}
                            </Badge>
                            {r.letzteMahnung && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatDatum(r.letzteMahnung)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full text-xs"
                            onClick={() => setDetailTarget(r)}
                          >
                            Details
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full text-xs"
                            onClick={() => {
                              if (!company) {
                                toast.error("Firmendaten werden geladen …");
                                return;
                              }
                              downloadInvoicePdf(r, company);
                            }}
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                          {istMahnbar(r, mounted) && (r.mahnstufe ?? 0) < 3 ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-full text-xs"
                              onClick={() => openMahnung(r)}
                            >
                              <Send className="h-3.5 w-3.5" />
                              {(r.mahnstufe ?? 0) === 0 ? "Mahnen" : "Nächste Stufe"}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rechnungen.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Keine Rechnungen gefunden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 space-y-1 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <p>{STEUER_HINWEIS.befreit_4_17b}</p>
            <p className="italic">{STEUER_DISCLAIMER}</p>
          </div>
        </CardContent>
      </Card>


      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <p className="text-sm text-muted-foreground">
            Weiterführende Auswertungen finden Sie in Buchhaltung und Berichten.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link to="/buchhaltung">
                Buchhaltung <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/berichte">
                Berichte <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <RechnungDetailDialog
        rechnung={
          detailTarget ? (alleRechnungen.find((r) => r.id === detailTarget.id) ?? detailTarget) : null
        }
        onClose={() => setDetailTarget(null)}
      />



      {/* Mahnwesen-Dialog */}
      <Dialog open={!!mahnTarget} onOpenChange={(o) => !o && setMahnTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {mahnTarget ? `${mahnStufeLabel(mahnStufe)} – ${mahnTarget.nummer}` : "Mahnung"}
            </DialogTitle>
            <DialogDescription>
              Fertiger Mahntext zum Kopieren oder Download. Der Versand erfolgt manuell – GHASI AI
              versendet nichts automatisch.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={mahnText}
            onChange={(e) => setMahnText(e.target.value)}
            className="min-h-[320px] font-mono text-xs"
          />
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(mahnText);
                  toast.success("Mahntext kopiert");
                }}
              >
                <Copy className="h-4 w-4" /> Kopieren
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  mahnTarget &&
                  downloadText(`Mahnung_${mahnTarget.nummer}.txt`, mahnText)
                }
              >
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
            <Button size="sm" disabled={updateMut.isPending} onClick={markiereMahnungVersendet}>
              {updateMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Als versendet markieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
