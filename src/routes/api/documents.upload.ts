// P0.1 STORAGE — Server route for authorized document upload.
//
// Guarantees:
// - Bearer token verified via supabaseAdmin.auth.getUser (no client identity).
// - Role gated to admin | disposition | finanz.
// - File validation: size ≤ 10 MiB, extension/MIME/magic bytes must agree
//   (PDF, JPEG, PNG, WebP only).
// - Multipart metadata is validated with a STRICT Zod schema. Unknown keys
//   and multiple values per key are rejected (400). No client-supplied
//   values may control id, storage path, uploader, role or timestamps.
// - Server-generated storage path: `<uuid>/<uuid>.<ext>` (never the original
//   filename).
// - Failure-safe: object removed if metadata insert fails.
// - Response returns the CLIENT DTO — never `storage_path`, `uploaded_by`,
//   or internal error text.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  formatVonDatei,
  documentRowToClientDto,
  type DokumentRecord,
  type DocumentRow,
} from "@/lib/documents-shared";
import { DOKUMENT_KATEGORIEN, DOKUMENT_BEZUG_TYPEN } from "@/lib/documents";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MiB

type ErlaubterMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

const MIME_ZU_ENDUNG: Record<ErlaubterMime, "pdf" | "jpg" | "png" | "webp"> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const ENDUNG_ZU_MIME: Record<string, ErlaubterMime> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Erkennt das echte Dateiformat anhand der Magic Bytes. */
function pruefeMagicBytes(bytes: Uint8Array): ErlaubterMime | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return "application/pdf"; // "%PDF"
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 // "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function jsonErr(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// -----------------------------------------------------------------------------
// Strikte Metadata-Validierung. Kein `as`-Cast als Ersatz.
// Steuerzeichen (\x00-\x1F, \x7F) sind in Textfeldern verboten.
// -----------------------------------------------------------------------------
const KATEGORIE_ENUM = z.enum(DOKUMENT_KATEGORIEN as unknown as [string, ...string[]]);
const BEZUG_TYP_ENUM = z.enum(DOKUMENT_BEZUG_TYPEN as unknown as [string, ...string[]]);
// eslint-disable-next-line no-control-regex
const OHNE_STEUERZEICHEN = /^[^\x00-\x1F\x7F]*$/;

const ORDNER_SCHEMA = z
  .string()
  .trim()
  .min(1, "Ordner erforderlich.")
  .max(120)
  .regex(OHNE_STEUERZEICHEN, "Ungültige Zeichen im Ordner.");

const BEZUG_SCHEMA = z
  .object({
    typ: BEZUG_TYP_ENUM,
    label: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(OHNE_STEUERZEICHEN, "Ungültige Zeichen im Bezug."),
    // to wird VOM SERVER verworfen und über bezug.typ neu abgeleitet.
    to: z.string().optional(),
  })
  .strict()
  .transform((b) => ({ typ: b.typ, label: b.label }));

const TAG_SCHEMA = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(OHNE_STEUERZEICHEN, "Ungültige Zeichen im Tag.");

const TAGS_JSON_SCHEMA = z
  .string()
  .transform((s, ctx) => {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "tags: ungültiges JSON." });
      return z.NEVER;
    }
  })
  .pipe(z.array(TAG_SCHEMA).max(20))
  .transform((tags) => Array.from(new Set(tags)));

const BEZUG_JSON_SCHEMA = z
  .string()
  .transform((s, ctx) => {
    try {
      return JSON.parse(s) as unknown;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "bezug: ungültiges JSON." });
      return z.NEVER;
    }
  })
  .pipe(BEZUG_SCHEMA);

const METADATA_SCHEMA = z
  .object({
    kategorie: KATEGORIE_ENUM,
    ordner: ORDNER_SCHEMA,
    tags: TAGS_JSON_SCHEMA.optional(),
    bezug: BEZUG_JSON_SCHEMA.optional(),
  })
  .strict();

const ERLAUBTE_FORM_KEYS = new Set(["file", "kategorie", "ordner", "tags", "bezug"]);

/**
 * Extrahiert Metadaten aus FormData mit strengen Regeln:
 * - kein Feld darf mehrfach vorkommen,
 * - Textfelder müssen wirklich Strings sein,
 * - unbekannte Felder werden abgelehnt.
 */
function extrahiereMetadataFelder(form: FormData): Record<string, string> | Response {
  const felder: Record<string, string> = {};
  const gesehen = new Map<string, number>();
  for (const [key] of form.entries()) {
    gesehen.set(key, (gesehen.get(key) ?? 0) + 1);
  }
  for (const [key, count] of gesehen.entries()) {
    if (!ERLAUBTE_FORM_KEYS.has(key)) {
      return jsonErr(400, `Unbekanntes Feld: ${key}.`);
    }
    if (count > 1) {
      return jsonErr(400, `Feld ${key} darf nur einmal übergeben werden.`);
    }
  }
  for (const key of ["kategorie", "ordner", "tags", "bezug"] as const) {
    const val = form.get(key);
    if (val == null) continue;
    if (typeof val !== "string") {
      return jsonErr(400, `Feld ${key} muss Text sein.`);
    }
    felder[key] = val;
  }
  return felder;
}

export const Route = createFileRoute("/api/documents/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Bearer-Token verifizieren.
        const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
        const token = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
        if (!token) return jsonErr(401, "Nicht angemeldet.");
        const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userRes.user) return jsonErr(401, "Nicht angemeldet.");
        const userId = userRes.user.id;

        // 2. Rollenprüfung.
        const { data: roles, error: rolesErr } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        if (rolesErr) {
          console.error("[documents.upload] role lookup failed", rolesErr.message);
          return jsonErr(500, "Rollenprüfung fehlgeschlagen.");
        }
        const erlaubteRollen = new Set(["admin", "disposition", "finanz"]);
        const hatRolle = (roles ?? []).some((r) =>
          erlaubteRollen.has((r as { role: string }).role),
        );
        if (!hatRolle) return jsonErr(403, "Keine Berechtigung zum Hochladen von Dokumenten.");

        // 3. Multipart parsen.
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return jsonErr(400, "Ungültiger Upload (multipart erforderlich).");
        }
        const file = form.get("file");
        if (!(file instanceof File)) return jsonErr(400, "Datei fehlt.");

        // Weitere Datei-Einträge sind nicht erlaubt (z. B. tags als Datei).
        for (const [k, v] of form.entries()) {
          if (k !== "file" && v instanceof File) {
            return jsonErr(400, `Feld ${k} darf keine Datei sein.`);
          }
        }

        // 4. Größe.
        if (file.size <= 0) return jsonErr(400, "Datei ist leer.");
        if (file.size > MAX_UPLOAD_BYTES) return jsonErr(413, "Datei ist zu groß (max. 10 MiB).");

        // 5. Endung.
        const originalName = file.name || "dokument";
        const extRaw = originalName.includes(".")
          ? originalName.split(".").pop()!.toLowerCase()
          : "";
        const erwarteterMimeFuerExt = ENDUNG_ZU_MIME[extRaw];
        if (!erwarteterMimeFuerExt) {
          return jsonErr(415, "Nur PDF, JPEG, PNG oder WebP erlaubt.");
        }

        // 6. Angegebener MIME.
        const angegebenerMime = (file.type || "").toLowerCase();
        if (!(angegebenerMime in MIME_ZU_ENDUNG)) {
          return jsonErr(415, "Angegebener Dateityp ist nicht erlaubt.");
        }
        if (angegebenerMime !== erwarteterMimeFuerExt) {
          return jsonErr(415, "Dateiendung und Dateityp passen nicht zusammen.");
        }

        // 7. Magic bytes.
        const buf = new Uint8Array(await file.arrayBuffer());
        const echterMime = pruefeMagicBytes(buf);
        if (!echterMime || echterMime !== angegebenerMime) {
          return jsonErr(415, "Dateiinhalt passt nicht zum angegebenen Dateityp.");
        }

        // 8. Metadata: Whitelist-Extraktion + strikte Zod-Validierung.
        const felder = extrahiereMetadataFelder(form);
        if (felder instanceof Response) return felder;
        const parsed = METADATA_SCHEMA.safeParse(felder);
        if (!parsed.success) {
          const first = parsed.error.issues[0];
          return jsonErr(400, first?.message ?? "Ungültige Angaben.");
        }
        const meta = parsed.data;

        // 9. Serverseitiger Pfad – nur UUIDs, keine Original-Namen.
        const finalExt = MIME_ZU_ENDUNG[echterMime];
        const path = `${crypto.randomUUID()}/${crypto.randomUUID()}.${finalExt}`;

        // 10. Upload via Admin (storage.objects hat keine Client-Policies).
        const { error: upErr } = await supabaseAdmin.storage
          .from("documents")
          .upload(path, buf, { contentType: echterMime, upsert: false });
        if (upErr) {
          console.error("[documents.upload] storage upload failed", upErr.message);
          return jsonErr(500, "Upload fehlgeschlagen.");
        }

        // 11. Metadaten – Insert. server-owned Felder werden hier gesetzt.
        const format = formatVonDatei(file);
        const row = {
          name: originalName.slice(0, 200),
          kategorie: meta.kategorie,
          format,
          ordner: meta.ordner,
          tags: meta.tags ?? [],
          bezug: meta.bezug ?? null,
          storage_path: path,
          groesse_kb: Math.max(1, Math.round(file.size / 1024)),
          hochgeladen_von: userRes.user.email ?? "",
          uploaded_by: userId,
          status: "active" as const,
        };

        const { data: created, error: insErr } = await supabaseAdmin
          .from("documents")
          .insert(row as never)
          .select()
          .single();
        if (insErr || !created) {
          await supabaseAdmin.storage.from("documents").remove([path]);
          console.error("[documents.upload] metadata insert failed", insErr?.message);
          return jsonErr(500, "Metadaten konnten nicht gespeichert werden.");
        }

        const dokument: DokumentRecord = documentRowToClientDto(created as unknown as DocumentRow);
        return Response.json(dokument);
      },
    },
  },
});
