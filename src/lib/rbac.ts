// Role-based access enforcement helpers. Every API route should call one of
// these. The cardinal rule: a non-admin user may only touch data belonging to
// their own clientId.

import { HttpError, type SessionPayload, requireSession } from "./auth";
import { isAdminRole, type Role } from "./enums";

export async function requireRole(allowed: Role[]): Promise<SessionPayload> {
  const s = await requireSession();
  if (!allowed.includes(s.role)) throw new HttpError(403, "Forbidden");
  return s;
}

export async function requireAdmin(): Promise<SessionPayload> {
  return requireRole(["SUPERADMIN", "ADMIN"]);
}

export async function requireSuperAdmin(): Promise<SessionPayload> {
  return requireRole(["SUPERADMIN"]);
}

/**
 * Returns the session, ensuring the user has access to the given clientId.
 * Admins can access any client; others must match their assigned client.
 */
export async function requireClientAccess(clientId: string): Promise<SessionPayload> {
  const s = await requireSession();
  if (isAdminRole(s.role)) return s;
  if (!s.clientId || s.clientId !== clientId) {
    throw new HttpError(403, "Not authorized for this client");
  }
  return s;
}

export function assertCanEdit(session: SessionPayload) {
  if (session.role === "VIEWER") throw new HttpError(403, "Read-only role");
}

export function assertCanPublish(session: SessionPayload, canPublishDirectly: boolean) {
  if (isAdminRole(session.role)) return;
  if (!canPublishDirectly) throw new HttpError(403, "Direct publish not allowed");
  if (session.role === "VIEWER" || session.role === "CLIENT_EDITOR") {
    throw new HttpError(403, "Only client owner / admin may publish");
  }
}
