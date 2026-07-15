// P0.2.1 — Scoped normalisation of the generated `requireSupabaseAuth`
// error. `requireSupabaseAuth` throws a plain `Error("Unauthorized: ...")`
// which the TanStack RPC layer surfaces as 500. Document server functions
// require a runtime-visible 401 for missing/invalid/expired bearers.
//
// This middleware is deliberately dumb:
// - It runs BEFORE `requireSupabaseAuth` (outermost) and only maps the
//   known `Unauthorized:`-prefixed errors from the generated auth module
//   to a native `Response(401)`.
// - Every other failure — including the 403 from `requireDocumentRole`,
//   the 404 for unknown documents, and any 500 from Postgres/Storage —
//   is re-thrown unchanged so its original status is preserved.
// - Does NOT import any secret, admin client, or browser input.
import { createMiddleware } from "@tanstack/react-start";

function istSupabaseAuthFehler(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("Unauthorized:");
}

export const documentAuthStatusMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    try {
      return await next();
    } catch (error) {
      if (error instanceof Response) throw error; // 403/404/500 unverändert
      if (istSupabaseAuthFehler(error)) {
        throw new Response(JSON.stringify({ error: "Nicht angemeldet." }), {
          status: 401,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }
      throw error;
    }
  },
);
