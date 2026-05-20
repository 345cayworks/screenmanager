import { prisma } from "./prisma";

export type AuditInput = {
  userId?: string | null;
  clientId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function audit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        clientId: input.clientId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        beforeData: input.before ? JSON.stringify(input.before) : null,
        afterData: input.after ? JSON.stringify(input.after) : null,
      },
    });
  } catch (err) {
    // Audit failures must never break the calling request.
    console.error("[audit] write failed", err);
  }
}
