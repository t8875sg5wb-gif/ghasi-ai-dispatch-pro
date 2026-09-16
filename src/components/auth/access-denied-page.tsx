import { ShieldAlert, type LucideIcon } from "lucide-react";

import { PageHero } from "@/components/enterprise/page-hero";
import { Card, CardContent } from "@/components/ui/card";

export function AccessDeniedPage({
  title,
  description,
  icon,
  badge,
  message,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  message: string;
}) {
  return (
    <div className="animate-fade-in space-y-6">
      <PageHero title={title} description={description} icon={icon} badge={badge} />
      <Card className="border-border/70 shadow-card">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}
