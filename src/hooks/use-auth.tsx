// Zentraler Auth-Kontext für GHASI AI.
// Verwaltet Session, Benutzerprofil und Rolle und stellt Anmelde-/Abmelde-Funktionen bereit.
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { type AppRole, hoechsteRolle } from "@/lib/roles";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  rollen: AppRole[];
  name: string;
  loading: boolean;
  rollenGeladen: boolean;
  signInEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpEmail: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signInGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [rollen, setRollen] = useState<AppRole[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const ladeProfil = useCallback(async (userId: string) => {
    const [{ data: rollenData }, { data: profil }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("name").eq("id", userId).maybeSingle(),
    ]);
    setRollen(((rollenData ?? []).map((r) => r.role) as AppRole[]) ?? []);
    if (profil?.name) setName(profil.name);
  }, []);

  useEffect(() => {
    // Synchroner Listener zuerst, dann initiale Session lesen.
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        // Profil-/Rollenabfrage außerhalb des Callbacks (Deadlock vermeiden).
        setTimeout(() => void ladeProfil(nextSession.user.id), 0);
      } else {
        setRollen([]);
        setName("");
      }
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        qc.invalidateQueries();
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) void ladeProfil(data.session.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [ladeProfil, qc]);

  const signInEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string, nm: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { name: nm },
      },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInGoogle = useCallback(async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return { error: result.error.message };
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    await qc.cancelQueries();
    await supabase.auth.signOut();
    qc.clear();
    setSession(null);
    setRollen([]);
    setName("");
  }, [qc]);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    role: hoechsteRolle(rollen),
    rollen,
    name: name || session?.user?.email?.split("@")[0] || "Benutzer",
    loading,
    signInEmail,
    signUpEmail,
    signInGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von AuthProvider verwendet werden");
  return ctx;
}
