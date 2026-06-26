// Gate: zeigt die App nur angemeldeten Nutzern, sonst den Anmeldebildschirm.
import { type ReactNode } from "react";
import { Bot } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { AuthScreen } from "@/components/auth/auth-screen";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

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

  return <>{children}</>;
}
