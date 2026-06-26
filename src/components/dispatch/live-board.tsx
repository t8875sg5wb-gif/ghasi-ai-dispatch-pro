// ============================================================
// GHASI AI – Enterprise Live-Board
// Feingranulares 12-Spalten-Dispatch-Board mit Drag & Drop,
// Such-/Filter-Leiste, Schnellbefehlen, Mehrfachauswahl und
// Bulk-Export (CSV / Excel / Druck-Routenblatt). Additiv – nutzt
// ausschließlich bestehende Datenmodelle & Services.
// ============================================================
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  FileText,
  MapPin,
  Printer,
  Search,
  Siren,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  PRIORITAET_META,
  PRIORITAETEN,
  MOBILITAET_META,
  MOBILITAET_OPTIONEN,
  VERORDNUNG_META,
  effektiveMobilitaet,
  effektiveVerordnung,
  verordnungFehlt,
} from "@/lib/auftraege";
import { INITIAL_FAHRER } from "@/lib/fahrer";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";
import { LIVE_STATUS_META, type DispatchTransport } from "@/lib/dispatch";
import { fahrzeugMismatch } from "@/components/auftraege/medizin-details";
import {
  BOARD_SPALTEN,
  LEERER_FILTER,
  SCHNELLBEFEHLE,
  aktiveFilterAnzahl,
  boardSpalteVon,
  exportiereCsv,
  exportiereExcel,
  druckeRoutenblatt,
  filterAktiv,
  wendeFilterAn,
  type BoardSpalte,
  type DispatchFilter,
} from "@/lib/dispatch-board";

const ALLE = "__alle__";

export function LiveBoard({
  transporte,
  konfliktIds,
  onOpen,
  onMove,
}: {
  transporte: DispatchTransport[];
  konfliktIds: Set<string>;
  onOpen: (t: DispatchTransport) => void;
  onMove: (id: string, spalte: BoardSpalte) => void;
}) {
  const [filter, setFilter] = useState<DispatchFilter>(LEERER_FILTER);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropZiel, setDropZiel] = useState<BoardSpalte | null>(null);

  const kostentraeger = useMemo(
    () => Array.from(new Set(transporte.map((t) => t.kostentraeger))).sort(),
    [transporte],
  );

  const gefiltert = useMemo(() => wendeFilterAn(transporte, filter), [transporte, filter]);

  const proSpalte = useMemo(() => {
    const map = new Map<BoardSpalte, DispatchTransport[]>();
    for (const s of BOARD_SPALTEN) map.set(s.key, []);
    for (const t of gefiltert) map.get(boardSpalteVon(t))!.push(t);
    return map;
  }, [gefiltert]);

  const setF = (patch: Partial<DispatchFilter>) => setFilter((p) => ({ ...p, ...patch }));

  const toggle = (id: string) =>
    setAuswahl((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const ausgewaehlteTransporte = useMemo(
    () => gefiltert.filter((t) => auswahl.has(t.id)),
    [gefiltert, auswahl],
  );

  const drop = (spalte: BoardSpalte) => {
    if (dragId) onMove(dragId, spalte);
    setDragId(null);
    setDropZiel(null);
  };

  const bulkVerschieben = (spalte: BoardSpalte) => {
    if (auswahl.size === 0) return;
    for (const id of auswahl) onMove(id, spalte);
    toast.success(`${auswahl.size} Transporte verschoben`, {
      description: BOARD_SPALTEN.find((s) => s.key === spalte)?.label,
    });
    setAuswahl(new Set());
  };

  return (
    <div className="space-y-3">
      {/* Such- & Filterleiste */}
      <div className="rounded-2xl border border-border/70 bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter.text}
              onChange={(e) => setF({ text: e.target.value })}
              placeholder="Suche: Nummer, Patient, Ort, Fahrer, Fahrzeug …"
              className="pl-9"
            />
          </div>

          <FilterSelect
            value={filter.fahrer}
            onChange={(v) => setF({ fahrer: v })}
            placeholder="Fahrer"
            options={INITIAL_FAHRER.map((f) => ({ value: f.name, label: f.name }))}
          />
          <FilterSelect
            value={filter.fahrzeug}
            onChange={(v) => setF({ fahrzeug: v })}
            placeholder="Fahrzeug"
            options={INITIAL_FAHRZEUGE.map((f) => ({
              value: f.kennzeichen,
              label: f.kennzeichen,
            }))}
          />
          <FilterSelect
            value={filter.kostentraeger}
            onChange={(v) => setF({ kostentraeger: v })}
            placeholder="Kostenträger"
            options={kostentraeger.map((k) => ({ value: k, label: k }))}
          />
          <FilterSelect
            value={filter.prioritaet}
            onChange={(v) => setF({ prioritaet: v as DispatchFilter["prioritaet"] })}
            placeholder="Priorität"
            options={PRIORITAETEN.map((p) => ({ value: p, label: PRIORITAET_META[p].label }))}
          />
          <FilterSelect
            value={filter.mobilitaet}
            onChange={(v) => setF({ mobilitaet: v as DispatchFilter["mobilitaet"] })}
            placeholder="Mobilität"
            options={MOBILITAET_OPTIONEN.map((m) => ({
              value: m,
              label: MOBILITAET_META[m].label,
            }))}
          />
          <FilterSelect
            value={filter.verordnung}
            onChange={(v) => setF({ verordnung: v as DispatchFilter["verordnung"] })}
            placeholder="Verordnung"
            options={[
              { value: "ok", label: "Vorhanden" },
              { value: "fehlt", label: "Fehlt" },
            ]}
          />
          <FilterSelect
            value={filter.begleitung}
            onChange={(v) => setF({ begleitung: v as DispatchFilter["begleitung"] })}
            placeholder="Begleitung"
            options={[
              { value: "ja", label: "Mit Begleitung" },
              { value: "nein", label: "Ohne Begleitung" },
            ]}
          />
          <FilterSelect
            value={filter.tageszeit}
            onChange={(v) => setF({ tageszeit: v as DispatchFilter["tageszeit"] })}
            placeholder="Zeit"
            options={[
              { value: "vormittag", label: "Vormittag" },
              { value: "nachmittag", label: "Nachmittag" },
            ]}
          />

          {filterAktiv(filter) && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => setFilter(LEERER_FILTER)}
            >
              <X className="h-4 w-4" />
              Filter zurücksetzen ({aktiveFilterAnzahl(filter)})
            </Button>
          )}
        </div>

        {/* Schnellbefehle */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">KI-Schnellbefehle:</span>
          {SCHNELLBEFEHLE.map((b) => (
            <Button
              key={b.id}
              variant="secondary"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                if (b.id === "verspaetet") {
                  setF({ text: "", verordnung: null, mobilitaet: null });
                  toast.info("Verspätete Transporte hervorgehoben");
                }
                setF(b.patch);
              }}
            >
              <b.icon className="h-3.5 w-3.5" />
              {b.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Bulk-Leiste */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card p-3">
        <span className="text-sm font-medium">
          {auswahl.size > 0 ? `${auswahl.size} ausgewählt` : `${gefiltert.length} Transporte`}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {auswahl.size > 0 && (
            <>
              <Select onValueChange={(v) => bulkVerschieben(v as BoardSpalte)}>
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue placeholder="Verschieben nach …" />
                </SelectTrigger>
                <SelectContent>
                  {BOARD_SPALTEN.map((s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAuswahl(new Set())}
                className="gap-1"
              >
                <X className="h-4 w-4" /> Auswahl löschen
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              const liste = auswahl.size > 0 ? ausgewaehlteTransporte : gefiltert;
              exportiereCsv(liste);
              toast.success(`${liste.length} Transporte als CSV exportiert`);
            }}
          >
            <FileText className="h-4 w-4" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              const liste = auswahl.size > 0 ? ausgewaehlteTransporte : gefiltert;
              exportiereExcel(liste);
              toast.success(`${liste.length} Transporte als Excel exportiert`);
            }}
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => {
              const liste = auswahl.size > 0 ? ausgewaehlteTransporte : gefiltert;
              if (liste.length === 0) {
                toast.error("Keine Transporte zum Drucken");
                return;
              }
              druckeRoutenblatt(liste);
            }}
          >
            <Printer className="h-4 w-4" /> Routenblatt / PDF
          </Button>
        </div>
      </div>

      {/* 12-Spalten Board */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3" style={{ minWidth: "min-content" }}>
          {BOARD_SPALTEN.map((s) => {
            const liste = proSpalte.get(s.key) ?? [];
            return (
              <div
                key={s.key}
                className="w-72 shrink-0"
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropZiel(s.key);
                }}
                onDragLeave={() => setDropZiel((z) => (z === s.key ? null : z))}
                onDrop={() => drop(s.key)}
              >
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <s.icon className="h-4 w-4 text-muted-foreground" />
                    {s.label}
                  </span>
                  <Badge variant="secondary" className="tabular-nums">
                    {liste.length}
                  </Badge>
                </div>
                <div
                  className={cn(
                    "min-h-[120px] space-y-2 rounded-2xl border border-dashed p-2 transition-colors",
                    s.ton,
                    dropZiel === s.key && "border-primary bg-primary/5",
                  )}
                >
                  {liste.length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Keine Transporte
                    </p>
                  )}
                  {liste.map((t) => (
                    <BoardCard
                      key={t.id}
                      t={t}
                      hatKonflikt={konfliktIds.has(t.id)}
                      ausgewaehlt={auswahl.has(t.id)}
                      onToggle={() => toggle(t.id)}
                      onClick={() => onOpen(t)}
                      onDragStart={() => setDragId(t.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value ?? ALLE} onValueChange={(v) => onChange(v === ALLE ? null : v)}>
      <SelectTrigger className="h-9 w-[150px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALLE}>{placeholder}: Alle</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BoardCard({
  t,
  hatKonflikt,
  ausgewaehlt,
  onToggle,
  onClick,
  onDragStart,
}: {
  t: DispatchTransport;
  hatKonflikt: boolean;
  ausgewaehlt: boolean;
  onToggle: () => void;
  onClick: () => void;
  onDragStart: () => void;
}) {
  const verspaetet = t.verspaetungMin >= 10 && t.liveStatus !== "abgeschlossen";
  const meta = LIVE_STATUS_META[verspaetet ? "verspaetet" : t.liveStatus];
  const prio = PRIORITAET_META[t.prioritaet];
  const mob = MOBILITAET_META[effektiveMobilitaet(t)];
  const ver = VERORDNUNG_META[effektiveVerordnung(t)];
  const fehlt = verordnungFehlt(effektiveVerordnung(t));
  const mismatch = fahrzeugMismatch(t);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        "group rounded-xl border bg-card p-2.5 text-left transition-all hover:shadow-card",
        ausgewaehlt ? "border-primary ring-1 ring-primary/40" : "border-border/70",
        hatKonflikt && !ausgewaehlt && "border-destructive/50",
      )}
    >
      <div className="flex items-center gap-2">
        <Checkbox
          checked={ausgewaehlt}
          onCheckedChange={onToggle}
          aria-label="Transport auswählen"
          className="shrink-0"
        />
        <button
          type="button"
          onClick={onClick}
          className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 active:cursor-grabbing"
        >
          <span className="truncate text-xs font-semibold tabular-nums">{t.nummer}</span>
          {t.istNotfall && <Siren className="h-3.5 w-3.5 shrink-0 text-destructive" />}
          {hatKonflikt && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
          <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
            {t.abholzeit}
          </span>
        </button>
      </div>

      <button type="button" onClick={onClick} className="mt-1 block w-full text-left">
        <p className="truncate text-sm font-medium">{t.patient}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          {t.abholort}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0 text-primary" />
          {t.zielort}
        </p>

        <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="tabular-nums">ETA {t.ankunftzeit}</span>
          <span className="truncate">{t.kostentraeger}</span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Badge className={cn("text-[10px]", meta.badge)}>{meta.label}</Badge>
          <Badge className={cn("text-[10px]", prio.badge)}>{prio.label}</Badge>
          <Badge className={cn("gap-1 text-[10px]", mob.badge)}>
            <mob.icon className="h-3 w-3" />
            {mob.kurz}
          </Badge>
          <Badge className={cn("gap-1 text-[10px]", ver.badge)}>
            <ver.icon className="h-3 w-3" />
            {ver.kurz}
          </Badge>
          {t.begleitperson ? (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <UserCheck className="h-3 w-3" /> Begl.
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 text-[10px] text-muted-foreground">
              <UserX className="h-3 w-3" /> Allein
            </Badge>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
          <span>{t.fahrer ?? "Fahrer —"}</span>
          <span>·</span>
          <span>{t.fahrzeug ?? "Fahrzeug —"}</span>
        </div>

        {verspaetet && (
          <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-destructive">
            <Clock className="h-3 w-3" /> {t.verspaetungMin} Min Verspätung
          </p>
        )}
        {fehlt && (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-destructive">
            <AlertTriangle className="h-3 w-3" /> Verordnung fehlt
          </p>
        )}
        {mismatch && (
          <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-warning">
            <AlertTriangle className="h-3 w-3" /> Fahrzeugtyp prüfen
          </p>
        )}
      </button>
    </div>
  );
}
