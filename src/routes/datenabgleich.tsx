// Datenabgleich: offene Verknüpfungen zwischen Aufträgen und Stammdaten
// (Patienten / Kostenträger) auflösen. Bewusst nur `orders` – Daueraufträge
// folgen in einem späteren Schritt.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { Link2, Users, Building2 } from "lucide-react";

import { useOrders, useUpdateOrder } from "@/lib/orders-store";
import { usePatients } from "@/lib/patients-store";
import { useInsurers } from "@/lib/insurers-store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/datenabgleich")({
  head: () => ({
    meta: [
      { title: "Datenabgleich – GHASI AI" },
      {
        name: "description",
        content:
          "Aufträge ohne stabile Verknüpfung zu Patienten oder Kostenträgern nachträglich zuordnen.",
      },
      { property: "og:title", content: "Datenabgleich – GHASI AI" },
      {
        property: "og:description",
        content: "Offene Verknüpfungen zwischen Aufträgen und Stammdaten auflösen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DatenabgleichSeite,
});

function DatenabgleichSeite() {
  const { data: auftraege = [], isLoading } = useOrders();
  const { data: patienten = [] } = usePatients();
  const { data: kassen = [] } = useInsurers();
  const updateMut = useUpdateOrder();

  const offenePatienten = useMemo(
    () => auftraege.filter((a) => !a.patientId && a.patient?.trim()),
    [auftraege],
  );
  const offeneKassen = useMemo(
    () => auftraege.filter((a) => !a.insurerId && a.kostentraeger?.trim()),
    [auftraege],
  );

  function verknuepfe(id: string, values: { patientId?: string; insurerId?: string }) {
    updateMut.mutate(
      { id, values },
      {
        onSuccess: () => toast.success("Verknüpfung gespeichert"),
        onError: (e) => toast.error(`Speichern fehlgeschlagen: ${(e as Error).message}`),
      },
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Datenabgleich</h1>
        <p className="text-sm text-muted-foreground">
          Aufträge, die Patient oder Kostenträger nur als Text führen. Eine Verknüpfung macht die
          Abrechnung und Vollständigkeitsprüfung eindeutig.
        </p>
      </header>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" /> Ohne Patientenverknüpfung
              </CardTitle>
              <Badge variant="secondary">{offenePatienten.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {offenePatienten.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Alle Aufträge sind mit einem Patientendatensatz verknüpft.
                </p>
              ) : (
                offenePatienten.map((a) => (
                  <div
                    key={a.id}
                    className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.patient}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.nummer} · {new Date(a.termin).toLocaleDateString("de-DE")}
                      </p>
                    </div>
                    <Select
                      value=""
                      onValueChange={(v) => verknuepfe(a.id, { patientId: v })}
                      disabled={patienten.length === 0 || updateMut.isPending}
                    >
                      <SelectTrigger className="sm:w-64">
                        <SelectValue placeholder="Patient zuordnen …" />
                      </SelectTrigger>
                      <SelectContent>
                        {patienten.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Noch keine Patienten angelegt.
                          </div>
                        ) : (
                          patienten.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4" /> Ohne Kostenträgerverknüpfung
              </CardTitle>
              <Badge variant="secondary">{offeneKassen.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {offeneKassen.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Alle Aufträge sind mit einem Kostenträger verknüpft.
                </p>
              ) : (
                offeneKassen.map((a) => (
                  <div
                    key={a.id}
                    className="grid gap-2 rounded-xl border border-border/70 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.kostentraeger}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.nummer} · {a.patient}
                      </p>
                    </div>
                    <Select
                      value=""
                      onValueChange={(v) => verknuepfe(a.id, { insurerId: v })}
                      disabled={kassen.length === 0 || updateMut.isPending}
                    >
                      <SelectTrigger className="sm:w-64">
                        <SelectValue placeholder="Kostenträger zuordnen …" />
                      </SelectTrigger>
                      <SelectContent>
                        {kassen.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">
                            Noch keine Kostenträger angelegt.
                          </div>
                        ) : (
                          kassen.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                              {k.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link2 className="size-3.5" /> Sobald eine Verknüpfung gesetzt ist, wird der Anzeigetext
        automatisch aus den Stammdaten abgeleitet.
      </p>
    </div>
  );
}
