
-- P0_STORAGE: Entfernt alle direkten Client-Policies auf storage.objects
-- fuer den 'documents'-Bucket. Zugriff laeuft ausschliesslich ueber
-- die neuen Server-Endpunkte (supabaseAdmin, Rollenpruefung).
DROP POLICY IF EXISTS "Berechtigte sehen Dokumentdateien"      ON storage.objects;
DROP POLICY IF EXISTS "Berechtigte laden Dokumentdateien hoch" ON storage.objects;
DROP POLICY IF EXISTS "Berechtigte aendern Dokumentdateien"    ON storage.objects;
DROP POLICY IF EXISTS "Berechtigte loeschen Dokumentdateien"   ON storage.objects;
