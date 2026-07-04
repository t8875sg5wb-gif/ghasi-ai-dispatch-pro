// Gate: zeigt die App nur angemeldeten Nutzern mit Rolle, sonst Anmeldung
// bzw. einen Freigabe-Hinweis für Konten ohne zugewiesene Rolle.
import { type ReactNode } from "react";
import { Bot, Clock, LogOut } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { AuthScreen } from "@/components/auth/auth-screen";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading, rollen, rollenGeladen, signOut, name } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-gradient-primary flex h-14 w-14 animate-pulse items-center justify-center rounded-3xl shadow-glow">
            <Bot className="h-7 w-7 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">GHASI AI wird geladen …</p>
        </div>
      </div>
    );
  }

  if (!session) return <AuthScreen />;

  // Rollen werden nach der Anmeldung asynchron geladen.
  if (!rollenGeladen) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="bg-gradient-primary flex h-14 w-14 animate-pulse items-center justify-center rounded-3xl shadow-glow">
            <Bot className="h-7 w-7 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Berechtigungen werden geprüft …</p>
        </div>
      </div>
    );
  }

  // Angemeldet, aber noch keine Rolle: auf Freigabe durch einen Admin warten.
  if (rollen.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
        <Card className="w-full max-w-md border-border/70 p-8 text-center shadow-card">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-warning/15 text-warning">
            <Clock className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Warten auf Freigabe</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Hallo {name}, Ihr Konto wurde erstellt, ist aber noch keiner Rolle zugeordnet.
            Ein Administrator muss Sie zunächst freischalten, bevor Sie Zugriff auf Daten
            erhalten. Bitte wenden Sie sich an Ihre Administration.
          </p>
          <Button variant="outline" className="mt-6 gap-2" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Abmelden
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
