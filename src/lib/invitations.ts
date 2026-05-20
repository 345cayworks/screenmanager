// Setup / password-reset tokens.
//
// Flow:
//   Admin invites or resets a user → we mint a high-entropy raw token,
//   hash it with sha256, and store only the hash. The raw token is
//   returned ONCE to the admin who shares the URL with the invitee.
//
//   The invitee POSTs the raw token + their chosen password to
//   /api/auth/setup-password. We re-hash and look up by setupTokenHash;
//   if it matches AND hasn't expired we set passwordHash, clear the
//   token fields, and sign them in.

import { randomBytes, createHash } from "node:crypto";
import { prisma } from "./prisma";

const DEFAULT_TTL_DAYS = 7;

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("base64url");
}

export function tokenExpiry(days = DEFAULT_TTL_DAYS): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Mint a new setup token for the given user. Returns the raw token —
 * caller must surface it to the admin and then discard it.
 */
export async function issueSetupToken(userId: string, ttlDays = DEFAULT_TTL_DAYS): Promise<string> {
  const raw = generateRawToken();
  const hash = hashToken(raw);
  await prisma.user.update({
    where: { id: userId },
    data: {
      setupTokenHash: hash,
      setupTokenExpiresAt: tokenExpiry(ttlDays),
    },
  });
  return raw;
}

/**
 * Validate a raw token. Returns the user id if the token matches a non-expired
 * record, null otherwise. Does NOT clear the token — the caller does that
 * inside the same transaction as the password set.
 */
export async function findUserBySetupToken(raw: string): Promise<{ id: string } | null> {
  if (!raw || typeof raw !== "string") return null;
  const hash = hashToken(raw);
  const user = await prisma.user.findFirst({
    where: {
      setupTokenHash: hash,
      setupTokenExpiresAt: { gt: new Date() },
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return user ?? null;
}
