// P0_STORAGE — Server route for authorized document upload.
// - Multipart form-data POST from the browser
// - Bearer token verified via supabaseAdmin.auth.getUser (no client identity)
// - Role gated to admin | disposition | finanz
// - File validation: size ≤ 10 MiB, allowed final types (pdf/jpeg/png/webp),
//   extension/MIME/signature (magic bytes) must all agree
// - Server-generated storage path: `<uuid>/<uuid>.<ext>` (never original name)
// - Failure-safe: object removed if metadata insert fails
import { createFileRoute } from "@tanstack/react-router";

import {
  formatVonDatei,
  type DokumentRecord,
  type DocumentRow,
  rowToDokument,
} from "@/lib/documents-shared";
import type {
  DokumentKategorie,
  DokumentBezug,
} from "@/lib/documents";

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
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
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
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // "WEBP"
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

export const Route = createFileRoute("/api/documents/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Bearer-Token verifizieren, Identität serverseitig ableiten.
        const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
        const token = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
        if (!token) return jsonErr(401, "Nicht angemeldet.");
        const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userRes.user) return jsonErr(401, "Nicht angemeldet.");
        const userId = userRes.user.id;

        // 2. Rollenprüfung: nur admin/disposition/finanz dürfen hochladen.
        const { data: roles, error: rolesErr } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        if (rolesErr) return jsonErr(500, "Rollenprüfung fehlgeschlagen.");
        const erlaubteRollen = new Set(["admin", "disposition", "finanz"]);
        const hatRolle = (roles ?? []).some((r) => erlaubteRollen.has((r as { role: string }).role));
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

        // 4. Größe.
        if (file.size <= 0) return jsonErr(400, "Datei ist leer.");
        if (file.size > MAX_UPLOAD_BYTES) return jsonErr(413, "Datei ist zu groß (max. 10 MiB).");

        // 5. Endung.
        const originalName = file.name || "dokument";
        const extRaw = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase() : "";
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

        // 8. Serverseitiger Pfad – nur UUIDs, keine Original-Namen.
        const finalExt = MIME_ZU_ENDUNG[echterMime];
        const path = `${crypto.randomUUID()}/${crypto.randomUUID()}.${finalExt}`;

        // 9. Upload via Admin (storage.objects hat keine Client-Policies mehr).
        const { error: upErr } = await supabaseAdmin.storage
          .from("documents")
          .upload(path, buf, { contentType: echterMime, upsert: false });
        if (upErr) return jsonErr(500, `Upload fehlgeschlagen: ${upErr.message}`);

        // 10. Metadaten – Insert. Bei Fehler Objekt zurückrollen.
        const kategorie = (form.get("kategorie") as string | null) ?? "patientendokument";
        const ordner = (form.get("ordner") as string | null) ?? "Allgemein";
        let tags: string[] = [];
        const tagsRaw = form.get("tags");
        if (typeof tagsRaw === "string" && tagsRaw.trim()) {
          try {
            const parsed = JSON.parse(tagsRaw);
            if (Array.isArray(parsed)) tags = parsed.filter((t) => typeof t === "string");
          } catch {
            /* ignore */
          }
        }
        let bezug: DokumentBezug | null = null;
        const bezugRaw = form.get("bezug");
        if (typeof bezugRaw === "string" && bezugRaw.trim()) {
          try {
            const parsed = JSON.parse(bezugRaw);
            if (parsed && typeof parsed === "object") bezug = parsed as DokumentBezug;
          } catch {
            /* ignore */
          }
        }

        const format = formatVonDatei(file);
        const row = {
          name: originalName.slice(0, 200),
          kategorie: kategorie as DokumentKategorie,
          format,
          ordner: ordner.slice(0, 120),
          tags,
          bezug,
          storage_path: path,
          groesse_kb: Math.max(1, Math.round(file.size / 1024)),
          hochgeladen_von: userRes.user.email ?? "",
          uploaded_by: userId,
        };

        const { data: created, error: insErr } = await supabaseAdmin
          .from("documents")
          .insert(row as never)
          .select()
          .single();
        if (insErr || !created) {
          await supabaseAdmin.storage.from("documents").remove([path]);
          return jsonErr(500, `Metadaten konnten nicht gespeichert werden: ${insErr?.message ?? ""}`);
        }

        const dokument: DokumentRecord = rowToDokument(created as unknown as DocumentRow);
        return Response.json(dokument);
      },
    },
  },
});
