// Kleines, wiederverwendbares Kennzeichen für geschätzte / angenommene Werte.
// Verfassung Art. 8: Schätzungen müssen als Schätzungen erkennbar sein.
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SchaetzungBadgeProps {
  /** Erklärung der Annahme (Tooltip). */
  hinweis: string;
  /** Anzeige-Text; Standard "Schätzung". */
  label?: string;
  className?: string;
}

/**
 * Zeigt einen dezenten "Schätzung"/"Annahme"-Marker mit erklärendem Tooltip.
 * Für alle Werte, die auf Annahmen statt echten Belegen beruhen.
 */
export function SchaetzungBadge({ hinweis, label = "Schätzung", className }: SchaetzungBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-help items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-warning",
            className,
          )}
        >
          <Info className="h-3 w-3" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{hinweis}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Gegenstück für Werte, die aus echten Belegen berechnet wurden.
 */
export function EchtBadge({ hinweis, label = "aus echten Belegen", className }: SchaetzungBadgeProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex cursor-help items-center gap-1 rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-success",
            className,
          )}
        >
          <Info className="h-3 w-3" />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{hinweis}</TooltipContent>
    </Tooltip>
  );
}
