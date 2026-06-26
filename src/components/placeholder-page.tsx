import { type ReactNode } from "react";
import { Sparkles, type LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlaceholderPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  features?: string[];
  children?: ReactNode;
}

export function PlaceholderPage({
  title,
  description,
  icon: Icon,
  features = [],
  children,
}: PlaceholderPageProps) {
  return (
    <div className="animate-fade-in space-y-6">
      <Card className="overflow-hidden border-border/70 shadow-card">
        <div className="bg-gradient-primary relative px-6 py-10 sm:px-10 sm:py-12">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Icon className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <Badge className="mb-2 border-0 bg-white/15 text-primary-foreground hover:bg-white/20">
                In Vorbereitung
              </Badge>
              <h1 className="text-2xl font-bold tracking-tight text-primary-foreground sm:text-3xl">
                {title}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-primary-foreground/80">{description}</p>
            </div>
          </div>
        </div>
      </Card>

      {features.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature}
              className="group border-border/70 transition-all hover:-translate-y-0.5 hover:shadow-card"
            >
              <CardHeader className="flex flex-row items-center gap-3 space-y-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent-foreground">
                  <Sparkles className="h-4 w-4 text-accent" />
                </div>
                <CardTitle className="text-sm font-medium">{feature}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {children ?? (
        <Card className="border-dashed border-border/70 bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <div className="bg-gradient-accent flex h-12 w-12 items-center justify-center rounded-2xl shadow-glow">
              <Icon className="h-6 w-6 text-primary-foreground" />
            </div>
            <p className="text-base font-semibold">Modul wird vorbereitet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Dieser Bereich ist Teil der modularen GHASI-AI-Architektur und wird im nächsten
              Schritt mit Funktionen befüllt.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
