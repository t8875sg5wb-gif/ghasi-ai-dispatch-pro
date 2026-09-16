import { describe, expect, it } from "bun:test";

import { documentErrorMessage, toDocumentClientError } from "@/lib/document-client-error";

describe("Dokumentdienst-Konfigurationsfehler", () => {
  it("bildet HTTP 503 auf eine sichere, eindeutige Meldung ab", () => {
    const error = toDocumentClientError(new Response("intern", { status: 503 }));
    expect(error.status).toBe(503);
    expect(documentErrorMessage(error)).toContain("serverseitig noch nicht konfiguriert");
  });
});
