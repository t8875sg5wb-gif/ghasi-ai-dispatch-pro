// CP-05 / P0.2.2 — Document-only client response & error boundary.
//
// Scope: ONLY the three document client paths (list, delete, signing).
// This module is pure, has no Supabase/browser dependency and is testable
// without a live account.
//
// Invariants:
// - The public error model exposes ONLY a fixed status and a fixed safe
//   German message. No Response, no body, no headers, no cause, no raw
//   JS/Supabase/Storage/SQL/auth error, no tokens/paths/ids/stack text.
// - A native `Response` is ALWAYS a failure — never a DTO, delete result or
//   signing result — even with a 2xx/3xx status.
// - Response bodies are never read (`.text()`/`.json()` are never called).
// - Unknown/unsupported failures collapse to a safe 500.
// - No `any`, no double casts, no type bypass. Global error handling is
//   untouched.
import { z } from "zod";

import {
  DOKUMENT_KATEGORIEN,
  DOKUMENT_BEZUG_TYPEN,
  type DokumentFormat,
} from "@/lib/documents";
import type { DokumentRecord } from "@/lib/documents-shared";

export type DocumentErrorStatus = 400 | 401 | 403 | 404 | 500;

const SAFE_MESSAGES: Record<DocumentErrorStatus, string> = {
  400: "Ungültige Anfrage.",
  401: "Sitzung abgelaufen. Bitte erneut anmelden.",
  403: "Keine Berechtigung für dieses Dokument.",
  404: "Dokument nicht verfügbar.",
  500: "Dokumentdienst momentan nicht verfügbar. Bitte erneut versuchen.",
};

const ERHALTENE_STATUS: readonly DocumentErrorStatus[] = [400, 401, 403, 404, 500];

/** Typed, safe, document-scoped client error. Carries nothing else. */
export class DocumentClientError extends Error {
  readonly status: DocumentErrorStatus;

  constructor(status: DocumentErrorStatus) {
    super(SAFE_MESSAGES[status]);
    this.name = "DocumentClientError";
    this.status = status;
  }
}

export function isDocumentClientError(value: unknown): value is DocumentClientError {
  return value instanceof DocumentClientError;
}

export function documentErrorMessage(value: unknown): string {
  return isDocumentClientError(value) ? value.message : SAFE_MESSAGES[500];
}

function statusVonResponse(status: number): DocumentErrorStatus {
  const treffer = ERHALTENE_STATUS.find((s) => s === status);
  return treffer ?? 500;
}

/**
 * Map any returned-or-thrown document failure to the typed safe error.
 * Never parses a response body; never infers a status from arbitrary
 * objects, `Error.message` or serialized server text.
 */
export function toDocumentClientError(value: unknown): DocumentClientError {
  if (isDocumentClientError(value)) return value;
  if (typeof Response !== "undefined" && value instanceof Response) {
    return new DocumentClientError(statusVonResponse(value.status));
  }
  return new DocumentClientError(500);
}

/** Every native `Response` is a failure, regardless of its status. */
function assertKeinResponse(value: unknown): void {
  if (typeof Response !== "undefined" && value instanceof Response) {
    throw toDocumentClientError(value);
  }
}

// ---------------------------------------------------------------------------
// Strict runtime success validation
// ---------------------------------------------------------------------------

const DOKUMENT_FORMATE = ["pdf", "bild", "tabelle", "text"] as const satisfies readonly DokumentFormat[];

const bezugSchema = z
  .object({
    typ: z.enum(DOKUMENT_BEZUG_TYPEN),
    label: z.string(),
    to: z.string().min(1),
  })
  .strict();

const dokumentRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    kategorie: z.enum(DOKUMENT_KATEGORIEN),
    format: z.enum(DOKUMENT_FORMATE),
    ordner: z.string(),
    tags: z.array(z.string()),
    bezug: bezugSchema.optional(),
    groesseKb: z.number(),
    ocrText: z.string().optional(),
    hochgeladenAm: z.string(),
  })
  .strict();

const dokumentListSchema = z.array(dokumentRecordSchema);

const deleteResultSchema = z.object({ ok: z.literal(true) }).strict();

const signedResultSchema = z
  .object({
    url: z.string().min(1),
    expiresIn: z.number().int().min(1).max(600),
  })
  .strict();

/** Validate a document list result; anything unexpected becomes a safe 500. */
export function parseDocumentList(value: unknown): DokumentRecord[] {
  assertKeinResponse(value);
  const parsed = dokumentListSchema.safeParse(value);
  if (!parsed.success) throw new DocumentClientError(500);
  return parsed.data;
}

/** Validate a delete result; resolves only for a confirmed `{ ok: true }`. */
export function parseDeleteResult(value: unknown): { ok: true } {
  assertKeinResponse(value);
  const parsed = deleteResultSchema.safeParse(value);
  if (!parsed.success) throw new DocumentClientError(500);
  return parsed.data;
}

/** Validate a signing result; URL must be non-empty and TTL within 1..600. */
export function parseSignedUrlResult(value: unknown): { url: string; expiresIn: number } {
  assertKeinResponse(value);
  const parsed = signedResultSchema.safeParse(value);
  if (!parsed.success) throw new DocumentClientError(500);
  return parsed.data;
}
