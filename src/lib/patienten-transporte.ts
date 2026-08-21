import type { Patient } from "@/lib/stammdaten";

/**
 * Liefert die Transporte, die über die stabile `patientId` mit einem Patienten
 * verknüpft sind. Namensvergleiche sind bewusst nicht erlaubt, um
 * Patientenverwechslungen bei gleichnamigen Personen zu vermeiden.
 *
 * Aufträge ohne `patientId` (reiner Freitext) werden nicht zugeordnet – sie
 * können nicht zuverlässig einem Profil zugeordnet werden.
 */
export function transporteFuerPatient<T extends { patientId?: string | null }>(
  patient: Pick<Patient, "id">,
  auftraege: T[],
): T[] {
  return auftraege.filter((a) => a.patientId === patient.id);
}
