import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { RestoreBackup } from "@/lib/backup-restore";
import {
  verifyRecoveryPrerequisites,
  type RecoveryExistenceProbe,
} from "@/lib/backup-recovery-verifier";

type ProbeResult<T> = PromiseLike<{ data: T; error: { message: string } | null }>;

export interface RecoverySupabaseAdminClient {
  auth: {
    admin: {
      getUserById: (userId: string) => ProbeResult<{ user: { id: string } | null } | null>;
    };
  };
  storage: {
    from: (bucket: "documents") => {
      exists: (path: string) => ProbeResult<boolean>;
    };
  };
}

export function createSupabaseRecoveryProbe(
  client: RecoverySupabaseAdminClient,
): RecoveryExistenceProbe {
  return {
    async authUserExists(userId) {
      const { data, error } = await client.auth.admin.getUserById(userId);
      if (error) throw new Error(`Auth-Service: ${error.message}`);
      return data?.user?.id === userId;
    },
    async storageObjectExists(bucket, path) {
      const { data, error } = await client.storage.from(bucket).exists(path);
      // storage-js kann bei einem echten 404 gleichzeitig `data: false` und
      // ein Fehlerobjekt liefern. Das ist "fehlt", kein Storage-Ausfall.
      if (data === false) return false;
      if (error) throw new Error(`Storage-Service: ${error.message}`);
      return data === true;
    },
  };
}

export async function verifyRecoveryPrerequisitesAgainstSupabase(
  candidate: RestoreBackup,
): Promise<void> {
  const probe = createSupabaseRecoveryProbe(
    supabaseAdmin as unknown as RecoverySupabaseAdminClient,
  );
  await verifyRecoveryPrerequisites(candidate, probe);
}
