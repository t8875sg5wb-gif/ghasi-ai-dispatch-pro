import { createFileRoute, Outlet, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Bot, PanelLeft } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ThreadSidebar } from "@/components/ki/thread-sidebar";

export const Route = createFileRoute("/ki-assistent")({
  head: () => ({
    meta: [
      { title: "GHASI AI – Executive-Assistent" },
      {
        name: "description",
        content:
          "GHASI AI, Ihr digitaler Geschäftsführer & persönlicher KI-Assistent: Geschäftswissen, Echtzeit-Internet, Dateien, Sprache – in natürlicher Unterhaltung.",
      },
    ],
  }),
  component: AssistantLayout,
});

function AssistantLayout() {
  const params = useParams({ strict: false }) as { threadId?: string };
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="animate-fade-in flex h-[calc(100vh-9rem)] gap-4">
      {/* Verlauf – Desktop */}
      <Card className="hidden w-72 shrink-0 overflow-hidden border-border/70 shadow-card md:flex">
        <ThreadSidebar activeId={params.threadId} />
      </Card>

      {/* Chat-Bereich */}
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 shadow-card">
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl md:hidden">
                <PanelLeft className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Gesprächsverlauf</SheetTitle>
              <ThreadSidebar activeId={params.threadId} onNavigate={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="bg-gradient-primary flex h-10 w-10 items-center justify-center rounded-2xl shadow-glow">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">GHASI AI</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-success" /> Online · Digitaler
              Geschäftsführer & Assistent
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <Outlet />
        </div>
      </Card>
    </div>
  );
}
