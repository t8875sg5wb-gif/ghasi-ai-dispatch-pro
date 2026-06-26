import { type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PageHeroProps {
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  right?: React.ReactNode;
}

/** Shared executive gradient header for new enterprise pages (matches GHASI design system). */
export function PageHero({ title, description, icon: Icon, badge, right }: PageHeroProps) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-card">
      <div className="bg-gradient-primary relative px-6 py-8 sm:px-10 sm:py-10">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Icon className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              {badge && (
                <Badge className="mb-2 border-0 bg-white/15 text-primary-foreground hover:bg-white/20">
                  {badge}
                </Badge>
              )}
              <h1 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl">
                {title}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-primary-foreground/80">{description}</p>
            </div>
          </div>
          {right && <div className="relative">{right}</div>}
        </div>
      </div>
    </Card>
  );
}
