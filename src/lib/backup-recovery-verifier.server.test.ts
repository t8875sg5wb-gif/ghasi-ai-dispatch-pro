import { describe, expect, it } from "bun:test";

import {
  createSupabaseRecoveryProbe,
  type RecoverySupabaseAdminClient,
} from "@/lib/backup-recovery-verifier.server";

function client(options?: {
  authData?: { user: { id: string } | null } | null;
  authError?: string;
  storageData?: boolean;
  storageError?: string;
}): RecoverySupabaseAdminClient {
  return {
    auth: {
      admin: {
        getUserById: async () => ({
          data: options?.authData ?? { user: { id: "user-1" } },
          error: options?.authError ? { message: options.authError } : null,
        }),
      },
    },
    storage: {
      from: () => ({
        exists: async () => ({
          data: options?.storageData ?? true,
          error: options?.storageError ? { message: options.storageError } : null,
        }),
      }),
    },
  };
}
describe("Supabase recovery existence probe", () => {
  it("verifies auth user identity and storage existence", async () => {
    const p = createSupabaseRecoveryProbe(client());
    await expect(p.authUserExists("user-1")).resolves.toBe(true);
    await expect(p.authUserExists("user-2")).resolves.toBe(false);
    await expect(p.storageObjectExists("documents", "a/b.pdf")).resolves.toBe(true);
  });

  it("fails closed on auth service errors", async () => {
    const p = createSupabaseRecoveryProbe(client({ authError: "down" }));
    await expect(p.authUserExists("user-1")).rejects.toThrow("Auth-Service");
  });

  it("returns false when storage reports an object as absent", async () => {
    const p = createSupabaseRecoveryProbe(client({ storageData: false }));
    await expect(p.storageObjectExists("documents", "a/b.pdf")).resolves.toBe(false);
  });

  it("fails closed on storage service errors", async () => {
    const p = createSupabaseRecoveryProbe(client({ storageError: "down" }));
    await expect(p.storageObjectExists("documents", "a/b.pdf")).rejects.toThrow("Storage-Service");
  });
});
