// OAuth-Consent-Route für externe MCP-Clients (ChatGPT, Claude, …).
// URL: /.lovable/oauth/consent?authorization_id=...
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

// Local wrapper for the beta supabase.auth.oauth namespace.
type OAuthDetails = {
  client?: { name?: string; client_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
};
type OAuthResult = {
  data: { redirect_url?: string; redirect_to?: string } | null;
  error: { message: string } | null;
};
type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = (): OAuthNamespace =>
  (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search }) => {
    if (!search.authorization_id) throw new Error("Fehlende authorization_id");
    // AuthGate zeigt automatisch die Anmeldung, wenn keine Session vorhanden ist.
    // Nach dem Login bleibt die URL erhalten → der User landet wieder hier.
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return { pending: true as const, details: null };
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return { pending: false as const, details: data };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md p-6 text-sm text-muted-foreground">
        Diese Autorisierungsanfrage konnte nicht geladen werden: {String((error as Error)?.message ?? error)}
      </Card>
    </div>
  ),
});

function Consent() {
  const { details, pending } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (pending) {
    // AuthGate im Root übernimmt die Anmeldung; nach Login rendert diese Seite neu.
    return null;
  }

  const clientName = details?.client?.name ?? "Externe Anwendung";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Keine Weiterleitungs-URL vom Auth-Server erhalten.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md space-y-5 p-8 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {clientName} mit GHASI AI verbinden
            </h1>
            <p className="text-xs text-muted-foreground">Zugriff auf Ihr Konto autorisieren</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {clientName} erhält die Möglichkeit, die aktivierten GHASI-AI-Tools in Ihrem Namen
          aufzurufen – solange Sie angemeldet sind. Die App-Berechtigungen und
          Backend-Richtlinien bleiben unverändert bestehen.
        </p>
        {details?.scope ? (
          <p className="text-xs text-muted-foreground">
            Angeforderte Bereiche: <span className="font-mono">{details.scope}</span>
          </p>
        ) : null}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            Genehmigen
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Ablehnen
          </Button>
        </div>
      </Card>
    </div>
  );
}
