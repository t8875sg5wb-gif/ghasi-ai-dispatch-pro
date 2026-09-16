// Gemeinsamer Helfer für nullable ID-Fremdschlüssel beim Lesen aus der DB.
//
// Altbestände können statt NULL einen leeren String enthalten. Solche Werte
// dürfen nicht erneut an strikte UUID-Schemas weitergereicht werden.
// Whitespace-only wird ebenfalls als fehlende Identität behandelt.
export function idOderNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  return v.trim().length === 0 ? null : v;
}
