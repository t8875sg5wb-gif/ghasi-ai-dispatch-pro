import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  MapPin,
  Stethoscope,
  User,
  UserCheck,
  UserX,
} from "lucide-react";

import {
  type Auftrag,
  MOBILITAET_META,
  VERORDNUNG_META,
  effektiveMobilitaet,
  effektiveVerordnung,
  empfohlenerFahrzeugtyp,
  fahrzeugPasstZuMobilitaet,
  verordnungFehlt,
} from "@/lib/auftraege";
import { INITIAL_FAHRZEUGE } from "@/lib/fahrzeuge";
import { INITIAL_DOKUMENTE } from "@/lib/documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MedizinAuftrag = Pick<
  Auftrag,
  | "transportart"
  | "fahrzeug"
  | "fahrer"
  | "verordnung"
  | "verordnungDokumentId"
  | "mobilitaet"
  | "begleitperson"
  | "abholanforderung"
  | "zielanforderung"
  | "patientennotiz"
  | "medizinischeNotiz"
>;

function fahrzeugEignung(kennzeichen: string | null) {
  const v = INITIAL_FAHRZEUGE.find((f) => f.kennzeichen === kennzeichen);
  if (!v) return null;
  return {
    kennzeichen: v.kennzeichen,
    rollstuhlGeeignet: v.rollstuhlGeeignet,
    liegendGeeignet: v.liegendGeeignet,
  };
}

/** Liefert die Warnung für falsch zugewiesenen Fahrzeugtyp (Disponent). */
export function fahrzeugMismatch(a: MedizinAuftrag): string | null {
  if (!a.fahrzeug) return null;
  const eignung = fahrzeugEignung(a.fahrzeug);
  if (!eignung) return null;
  const mob = effektiveMobilitaet(a);
  if (fahrzeugPasstZuMobilitaet(mob, eignung)) return null;
  return `Fahrzeug ${eignung.kennzeichen} passt nicht zur Mobilität „${MOBILITAET_META[mob].label}". Benötigt: ${empfohlenerFahrzeugtyp(mob)}.`;
}

/** Kompakte Badges für Karten/Listen (Verordnung, Mobilität, Begleitung). */
export function MedizinBadges({
  auftrag,
  className,
}: {
  auftrag: MedizinAuftrag;
  className?: string;
}) {
  const ver = VERORDNUNG_META[effektiveVerordnung(auftrag)];
  const mob = MOBILITAET_META[effektiveMobilitaet(auftrag)];
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <Badge className={cn("gap-1 text-[10px]", ver.badge)}>
        <ver.icon className="h-3 w-3" />
        {ver.kurz}
      </Badge>
      <Badge className={cn("gap-1 text-[10px]", mob.badge)}>
        <mob.icon className="h-3 w-3" />
        {mob.kurz}
      </Badge>
      {auftrag.begleitperson && (
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <UserCheck className="h-3 w-3" />
          Begleitung
        </Badge>
      )}
    </div>
  );
}

function Zeile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

/**
 * Vollständiger medizinischer Transport-Block.
 * Wird in Auftragsdetail, Dispatch, Fahrer-App und Patientenprofil
 * wiederverwendet. `rolle` steuert die Betonung der Warnungen.
 */
export function MedizinDetails({
  auftrag,
  rolle = "dispo",
}: {
  auftrag: MedizinAuftrag;
  rolle?: "dispo" | "fahrer";
}) {
  const verStatus = effektiveVerordnung(auftrag);
  const ver = VERORDNUNG_META[verStatus];
  const mob = MOBILITAET_META[effektiveMobilitaet(auftrag)];
  const dok = auftrag.verordnungDokumentId
    ? INITIAL_DOKUMENTE.find((d) => d.id === auftrag.verordnungDokumentId)
    : undefined;
  const fehlt = verordnungFehlt(verStatus);
  const mismatch = fahrzeugMismatch(auftrag);

  return (
    <div className="space-y-4">
      {/* Fahrer-Warnung: Verordnung fehlt */}
      {fehlt && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">
              {rolle === "fahrer"
                ? "Achtung: Verordnung fehlt – Transport ohne gültige Verordnung."
                : "Verordnung fehlt – vor Abfahrt klären."}
            </p>
            <p className="text-xs text-muted-foreground">
              Status: {ver.label}.{" "}
              {rolle === "fahrer"
                ? "Bitte beim Disponenten nachfragen."
                : "Fahrer informieren / Verordnung anfordern."}
            </p>
          </div>
        </div>
      )}

      {/* Disponenten-Warnung: falscher Fahrzeugtyp */}
      {mismatch && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div className="text-sm">
            <p className="font-semibold text-warning-foreground">Fahrzeugtyp prüfen</p>
            <p className="text-xs text-muted-foreground">{mismatch}</p>
          </div>
        </div>
      )}

      {/* Verordnung */}
      <div className="rounded-xl border border-border/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Verordnung
          </p>
          <Badge className={cn("gap-1", ver.badge)}>
            <ver.icon className="h-3 w-3" />
            {ver.label}
          </Badge>
        </div>
        {dok ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border/60 bg-muted/40 p-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-info/10 text-info">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{dok.name}</p>
              {dok.ocrText && (
                <p className="truncate text-xs text-muted-foreground">{dok.ocrText}</p>
              )}
            </div>
            <Button asChild size="sm" variant="outline" className="h-7 shrink-0 text-xs">
              <Link to="/dokumente">Vorschau</Link>
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Kein Verordnungsdokument hinterlegt.</p>
        )}
      </div>

      {/* Mobilität & Begleitperson */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/70 p-2.5">
          <p className="text-xs text-muted-foreground">Mobilität</p>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <mob.icon className="h-4 w-4" />
            {mob.label}
          </div>
        </div>
        <div className="rounded-lg border border-border/70 p-2.5">
          <p className="text-xs text-muted-foreground">Begleitperson</p>
          <div className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            {auftrag.begleitperson ? (
              <>
                <UserCheck className="h-4 w-4 text-success" /> Ja
              </>
            ) : (
              <>
                <UserX className="h-4 w-4 text-muted-foreground" /> Nein
              </>
            )}
          </div>
        </div>
      </div>

      {/* Anforderungen & Notizen */}
      <div className="space-y-3">
        {auftrag.abholanforderung && (
          <Zeile icon={MapPin} label="Anforderungen Abholort" value={auftrag.abholanforderung} />
        )}
        {auftrag.zielanforderung && (
          <Zeile icon={ArrowRight} label="Anforderungen Zielort" value={auftrag.zielanforderung} />
        )}
        {auftrag.patientennotiz && (
          <Zeile icon={User} label="Patientennotiz" value={auftrag.patientennotiz} />
        )}
        {auftrag.medizinischeNotiz && (
          <Zeile icon={Stethoscope} label="Medizinische Notiz" value={auftrag.medizinischeNotiz} />
        )}
      </div>
    </div>
  );
}
