import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export type AuditAction =
  | "create"
  | "update"
  | "void"
  | "delete"
  | "login"
  | "approve"
  | "reject"
  | "pay"
  | "lock";

export interface AuditInput {
  userId?: string | null;
  action: AuditAction;
  tableName: string;
  recordId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
}

/** Ubah nilai apa pun menjadi JSON-safe (Date -> ISO string, dsb). */
function clean(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Menulis audit trail. WAJIB dipanggil di dalam transaksi yang sama
 * dengan perubahan data agar jejak tidak pernah terlepas.
 */
export async function writeAudit(tx: Tx, input: AuditInput) {
  return tx.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      tableName: input.tableName,
      recordId: input.recordId,
      before: clean(input.before),
      after: clean(input.after),
      reason: input.reason ?? null,
    },
  });
}

/** Audit untuk aksi yang tidak memerlukan transaksi (login, dsb). */
export async function writeAuditStandalone(
  db: Prisma.TransactionClient,
  input: AuditInput,
) {
  return writeAudit(db, input);
}
