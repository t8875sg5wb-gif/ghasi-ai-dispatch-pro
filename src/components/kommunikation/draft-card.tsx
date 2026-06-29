// Action-Inbox-Karte: ein KI-Entwurf mit Erklärung, Quelldaten, Grund,
// bearbeitbarer Nachricht und Genehmigen / Bearbeiten / Verwerfen.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  Pencil,
  X,
  Sparkles,
  Info,
  ArrowRight,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { KANAL_META, KATEGORIE_META, PRIORITAET_META, type KommEntwurf } from "@/lib/communication";
import { genehmigeEntwurf, lehneEntwurfAb, bearbeiteEntwurf } from "@/lib/communication-store";

export function DraftCard({ entwurf }: { entwurf: KommEntwurf }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(entwurf.nachricht);

  const kanal = KANAL_META[entwurf.kanal];
  const kat = KATEGORIE_META[entwurf.kategorie];
  const prio = PRIORITAET_META[entwurf.prioritaet];
  const KanalIcon: LucideIcon = kanal.icon;
  const erledigt = entwurf.status !== "offen";

  const speichern = () => {
    bearbeiteEntwurf(entwurf.id, text);
    setEdit(false);
    toast.success("Entwurf aktualisiert");
  };

  const genehmigen = () => {
    if (edit) bearbeiteEntwurf(entwurf.id, text);
    genehmigeEntwurf(entwurf.id);
    toast.success("Freigegeben & gesendet", { description: entwurf.titel });
  };

  const verwerfen = () => {
    lehneEntwurfAb(entwurf.id);
    toast("Entwurf verworfen", { description: "Es wurde nichts gesendet." });
  };

  return (
    <Card
      className={cn(
        "border-border/70 shadow-sm transition-all",
        erledigt ? "opacity-70" : "hover:shadow-card",
      )}
    >
      <CardContent className="space-y-4 p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="bg-gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold leading-snug">{entwurf.titel}</p>
              <Badge variant="outline" className={cn("gap-1 text-[10px]", kanal.badge)}>
                <KanalIcon className="h-3 w-3" />
                {kanal.label}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px]", prio.badge)}>
                {prio.label}
              </Badge>
              <Badge variant="outline" className={cn("text-[10px]", kat.badge)}>
                {kat.label}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              An: <span className="font-medium text-foreground">{entwurf.empfaenger}</span>
              {entwurf.betreff ? ` · Betreff: ${entwurf.betreff}` : ""}
            </p>
          </div>
          {erledigt && (
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 gap-1 text-[10px]",
                entwurf.status === "genehmigt"
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-muted bg-muted text-muted-foreground",
              )}
            >
              {entwurf.status === "genehmigt" ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {entwurf.status === "genehmigt" ? "Gesendet" : "Verworfen"}
            </Badge>
          )}
        </div>

        {/* Explanation + reason */}
        <div className="space-y-2 rounded-xl bg-muted/40 p-3">
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium text-foreground">Warum: </span>
              {entwurf.erklaerung}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Auslöser: </span>
            {entwurf.grund}
          </p>
        </div>

        {/* Source data */}
        <div className="flex flex-wrap gap-2">
          {entwurf.quelldaten.map((q) => (
            <span
              key={q.label}
              className="rounded-lg border border-border/60 bg-card px-2 py-1 text-[11px]"
            >
              <span className="text-muted-foreground">{q.label}: </span>
              <span className="font-medium">{q.wert}</span>
            </span>
          ))}
        </div>

        {/* Editable message */}
        {edit ? (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            className="resize-y text-sm"
          />
        ) : (
          <pre className="whitespace-pre-wrap rounded-xl border border-border/60 bg-card p-3 font-sans text-sm leading-relaxed">
            {entwurf.nachricht}
          </pre>
        )}

        {/* Linked object */}
        {entwurf.bezug && (
          <Link
            to={entwurf.bezug.to}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Zum Ursprungsobjekt: {entwurf.bezug.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}

        {/* Actions */}
        {!erledigt && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={genehmigen} className="gap-1.5">
              <Check className="h-4 w-4" />
              Genehmigen
            </Button>
            {edit ? (
              <Button size="sm" variant="secondary" onClick={speichern} className="gap-1.5">
                <Check className="h-4 w-4" />
                Speichern
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEdit(true)}
                className="gap-1.5"
              >
                <Pencil className="h-4 w-4" />
                Bearbeiten
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={verwerfen}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
              Verwerfen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
