import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  Navigation,
  Phone,
  MapPin,
  Play,
  Flag,
  CheckCircle2,
  Clock,
  Smartphone,
  Loader2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useOrders, useUpdateOrder } from "@/lib/orders-store";
import { STATUS_META, type Auftrag } from "@/lib/auftraege";
import { formatAdresse } from "@/lib/address";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fahrer-mobil")({
  head: () => ({
    meta: [
      { title: "Meine Touren – GHASI AI" },
      { name: "description", content: "Mobile Fahreransicht: heutige Touren, Status und Navigation." },
    ],
  }),
  component: FahrerMobilPage,
});

function istHeute(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function uhrzeit(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function zielAdresse(a: Auftrag): string {
  return (a.destination && formatAdresse(a.destination)) || a.zielort || "";
}

function abholAdresse(a: Auftrag): string {
  return (a.pickup && formatAdresse(a.pickup)) || a.abholort || "";
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

function FahrerMobilPage() {
  const { name } = useAuth();
  const { data: orders = [], isLoading } = useOrders();
  const updateMut = useUpdateOrder();

  const meineTouren = useMemo(() => {
    const me = name.trim().toLowerCase();
    return orders
      .filter((o) => (o.fahrer ?? "").trim().toLowerCase() === me)
      .filter((o) => istHeute(o.termin))
      .filter((o) => o.status !== "storniert")
      .sort((a, b) => new Date(a.termin).getTime() - new Date(b.termin).getTime());
  }, [orders, name]);

  const offen = meineTouren.filter((o) => o.status !== "abgeschlossen").length;

  function setStatus(o: Auftrag, values: Parameters<typeof updateMut.mutate>[0]["values"], msg: string) {
    updateMut.mutate(
      { id: o.id, values },
      {
        onSuccess: () => toast.success(msg),
        onError: (e) => toast.error("Konnte nicht aktualisiert werden", { description: String(e) }),
      },
    );
  }

  return (
    <div className="animate-fade-in mx-auto max-w-xl space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-gradient-primary p-4 text-primary-foreground">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
          <Smartphone className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm opacity-90">Hallo {name}</p>
          <p className="text-lg font-bold leading-tight">Meine Touren heute</p>
        </div>
        <Badge className="ml-auto bg-white/20 text-primary-foreground">{offen} offen</Badge>
      </div>

      {isLoading && (
        <p className="py-8 text-center text-sm text-muted-foreground">Touren werden geladen …</p>
      )}

      {!isLoading && meineTouren.length === 0 && (
        <Card className="border-dashed border-border/70 bg-muted/30">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <p className="text-sm font-medium">Keine Touren für heute</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Sobald Ihnen Fahrten zugewiesen werden, erscheinen sie hier.
            </p>
          </CardContent>
        </Card>
      )}

      {meineTouren.map((o) => {
        const meta = STATUS_META[o.status];
        const angekommen = o.detailStatus === "angekommen";
        const ziel = zielAdresse(o);
        const pending = updateMut.isPending;
        return (
          <Card key={o.id} className="overflow-hidden border-border/70 shadow-card">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-lg font-bold tabular-nums">{uhrzeit(o.termin)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium">{o.patient}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.transportart} · {o.nummer}
                  </p>
                </div>
                <Badge variant="outline" className={cn("shrink-0", meta.badge)}>
                  {angekommen && o.status === "unterwegs" ? "Angekommen" : meta.label}
                </Badge>
              </div>

              <div className="space-y-1.5 rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">Abholung</p>
                    <p className="truncate">{abholAdresse(o) || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Flag className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">Ziel</p>
                    <p className="truncate">{ziel || "—"}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" className="rounded-xl" disabled={!ziel}>
                  <a href={ziel ? mapsUrl(ziel) : undefined} target="_blank" rel="noopener noreferrer">
                    <Navigation className="h-4 w-4" /> Navigation
                  </a>
                </Button>
                <Button asChild variant="outline" className="rounded-xl" disabled={!o.telefon}>
                  <a href={o.telefon ? `tel:${o.telefon}` : undefined}>
                    <Phone className="h-4 w-4" /> Anrufen
                  </a>
                </Button>
              </div>

              {/* One-tap status progression */}
              {(o.status === "neu" || o.status === "disponiert") && (
                <Button
                  className="w-full rounded-xl"
                  disabled={pending}
                  onClick={() => setStatus(o, { status: "unterwegs", detailStatus: "anfahrt" }, "Fahrt gestartet")}
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Fahrt starten
                </Button>
              )}
              {o.status === "unterwegs" && !angekommen && (
                <Button
                  variant="secondary"
                  className="w-full rounded-xl"
                  disabled={pending}
                  onClick={() => setStatus(o, { detailStatus: "angekommen" }, "Ankunft bestätigt")}
                >
                  <Flag className="h-4 w-4" /> Angekommen
                </Button>
              )}
              {o.status === "unterwegs" && angekommen && (
                <Button
                  className="w-full rounded-xl"
                  disabled={pending}
                  onClick={() =>
                    setStatus(o, { status: "abgeschlossen", detailStatus: "abgeschlossen" }, "Tour abgeschlossen")
                  }
                >
                  <CheckCircle2 className="h-4 w-4" /> Tour abschließen
                </Button>
              )}
              {o.status === "abgeschlossen" && (
                <div className="flex items-center justify-center gap-1.5 rounded-xl bg-success/10 py-2 text-sm font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" /> Abgeschlossen
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
