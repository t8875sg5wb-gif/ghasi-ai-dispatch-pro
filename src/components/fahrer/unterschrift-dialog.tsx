import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, CheckCircle2, Ban } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Erfassung der Patientenunterschrift beim Tourabschluss.
 * Die Unterschrift ist ein personenbezogenes Datum – sie wird ausschließlich
 * an den Abschluss-Callback übergeben und niemals protokolliert.
 */
export interface UnterschriftErgebnis {
  /** PNG-Data-URL, wenn unterschrieben wurde. */
  unterschrift: string | null;
  /** true, wenn die Unterschrift ausdrücklich nicht möglich war. */
  verweigert: boolean;
  /** Pflicht-Begründung bei verweigerter Unterschrift. */
  grund?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: string;
  busy?: boolean;
  onConfirm: (ergebnis: UnterschriftErgebnis) => void;
}

// Kleine, feste Zeichenfläche: hält das erzeugte PNG klein (< ~30 KB).
const CANVAS_W = 480;
const CANVAS_H = 180;

export function UnterschriftDialog({ open, onOpenChange, patient, busy, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const zeichnet = useRef(false);
  const [hatStriche, setHatStriche] = useState(false);
  const [modus, setModus] = useState<"unterschrift" | "verweigert">("unterschrift");
  const [grund, setGrund] = useState("");

  const leeren = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHatStriche(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setModus("unterschrift");
    setGrund("");
    // Nach dem Öffnen ist das Canvas erst im nächsten Frame gemountet.
    const id = requestAnimationFrame(() => leeren());
    return () => cancelAnimationFrame(id);
  }, [open, leeren]);

  function punkt(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * c.width,
      y: ((e.clientY - rect.top) / rect.height) * c.height,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    zeichnet.current = true;
    const p = punkt(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function bewegen(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = punkt(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hatStriche) setHatStriche(true);
  }

  function ende(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!zeichnet.current) return;
    zeichnet.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }

  function bestaetigen() {
    if (modus === "verweigert") {
      if (grund.trim().length < 3) return;
      onConfirm({ unterschrift: null, verweigert: true, grund: grund.trim().slice(0, 500) });
      return;
    }
    const c = canvasRef.current;
    if (!c || !hatStriche) return;
    onConfirm({ unterschrift: c.toDataURL("image/png"), verweigert: false });
  }

  const kannBestaetigen =
    modus === "verweigert" ? grund.trim().length >= 3 : hatStriche;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Leistungsnachweis</DialogTitle>
          <DialogDescription>
            Bitte lassen Sie {patient} den Transport mit einer Unterschrift bestätigen.
          </DialogDescription>
        </DialogHeader>

        {modus === "unterschrift" ? (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-2xl border border-border bg-white">
              <canvas
                ref={canvasRef}
                width={CANVAS_W}
                height={CANVAS_H}
                className="h-44 w-full touch-none"
                onPointerDown={start}
                onPointerMove={bewegen}
                onPointerUp={ende}
                onPointerCancel={ende}
                onPointerLeave={ende}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {hatStriche ? "Unterschrift erfasst" : "Mit Finger oder Maus unterschreiben"}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={leeren}>
                <Eraser className="h-4 w-4" /> Löschen
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => setModus("verweigert")}
            >
              <Ban className="h-4 w-4" /> Unterschrift nicht möglich
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="verweigert-grund">Begründung (Pflicht)</Label>
            <Textarea
              id="verweigert-grund"
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              maxLength={500}
              rows={4}
              placeholder="z. B. Patient bewusstlos, Übergabe an Pflegepersonal Station 4"
            />
            <p className="text-xs text-muted-foreground">
              Der Auftrag wird abgeschlossen, gilt aber <strong>nicht als unterschrieben</strong>.
              Die Abrechnungsprüfung meldet den fehlenden Nachweis weiterhin.
            </p>
            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-xl"
              onClick={() => setModus("unterschrift")}
            >
              <PenLine className="h-4 w-4" /> Doch unterschreiben
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            className="w-full rounded-xl"
            disabled={!kannBestaetigen || busy}
            onClick={bestaetigen}
          >
            <CheckCircle2 className="h-4 w-4" />
            {modus === "verweigert" ? "Ohne Unterschrift abschließen" : "Tour abschließen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
