// Übersicht „Unverknüpfte Einrichtungen“: listet alle Aufträge, bei denen die
// stabile Einrichtungs-Zuordnung (Abhol- und/oder Zielort) fehlt.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Link2Off, Search } from "lucide-react";

import { useOrders } from "@/lib/orders-store";
import { useFacilities } from "@/lib/facilities-store";
import { STATUS_META, formatTermin, type AuftragStatus } from "@/lib/auftraege";
import {
  findeUnverknuepfteTransporte,
  filterUnverknuepft,
  type UnverknuepftSeite,
} from "@/lib/unverknuepfte-einrichtungen";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ALLE = "__alle__";

export function UnverknuepfteUebersicht() {
  const { data: auftraege = [] } = useOrders();
  const { data: einrichtungen = [] } = useFacilities();
  const [einrichtungId, setEinrichtungId] = useState<string>(ALLE);
  const [status, setStatus] = useState<string>(ALLE);
  const [seite, setSeite] = useState<string>(ALLE);
  const [suche, setSuche] = useState("");

  const eintraege = useMemo(
    () => findeUnverknuepfteTransporte(auftraege, einrichtungen),
    [auftraege, einrichtungen],
  );

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return filterUnverknuepft(eintraege, {
      einrichtungId: einrichtungId === ALLE ? null : einrichtungId,
      status: status === ALLE ? null : status,
      seite: seite === ALLE ? null : (seite as UnverknuepftSeite),
    }).filter((e) => {
      if (!q) return true;
      const a = e.auftrag;
      return (
        a.nummer.toLowerCase().includes(q) ||
        a.patient.toLowerCase().includes(q) ||
        a.abholort.toLowerCase().includes(q) ||
        a.zielort.toLowerCase().includes(q)
      );
    });
  }, [eintraege, einrichtungId, status, seite, suche]);

  const nameById = useMemo(
    () => new Map(einrichtungen.map((e) => [e.id, e.name] as const)),
    [einrichtungen],
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10 text-warning">
          <Link2Off className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Unverknüpfte Einrichtungen</h1>
          <p className="text-sm text-muted-foreground">
            {eintraege.length} Transport(e) ohne stabile Einrichtungs-Zuordnung – Abhol- und/oder
            Zielort basiert nur auf Freitext.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Suche</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Nummer, Patient, Adresse…"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vermutete Einrichtung</Label>
            <Select value={einrichtungId} onValueChange={setEinrichtungId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALLE}>Alle Einrichtungen</SelectItem>
                {einrichtungen.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALLE}>Alle Status</SelectItem>
                {(Object.keys(STATUS_META) as AuftragStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fehlende Seite</Label>
            <Select value={seite} onValueChange={setSeite}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALLE}>Abhol- oder Zielort</SelectItem>
                <SelectItem value="abholort">Nur Abholort</SelectItem>
                <SelectItem value="zielort">Nur Zielort</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Treffer ({gefiltert.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {gefiltert.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Keine unverknüpften Transporte für diese Filter.
            </p>
          )}
          {gefiltert.map(({ auftrag: a, seiten, vermuteteEinrichtungIds }) => (
            <Link
              key={a.id}
              to="/auftraege"
              search={{ nummer: a.nummer }}
              className="block rounded-xl border border-border/70 p-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  {a.nummer} · {a.patient}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {seiten.map((s) => (
                    <Badge key={s} variant="outline" className="border-warning/30 text-[10px]">
                      {s === "abholort" ? "Abholort offen" : "Zielort offen"}
                    </Badge>
                  ))}
                  <Badge variant="outline" className={cn("gap-1", STATUS_META[a.status].badge)}>
                    {STATUS_META[a.status].label}
                  </Badge>
                </div>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {a.abholort} → {a.zielort} · {formatTermin(a.termin)}
              </p>
              {vermuteteEinrichtungIds.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Vermutet (nur Textabgleich, nicht verbindlich):{" "}
                  {vermuteteEinrichtungIds.map((id) => nameById.get(id) ?? id).join(", ")}
                </p>
              )}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
