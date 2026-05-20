// Shared enum constants & TS types. We use string fields in Prisma (SQLite-
// friendly) and constrain values here so the rest of the codebase stays type-safe.

export const ROLES = [
  "SUPERADMIN",
  "ADMIN",
  "CLIENT_OWNER",
  "CLIENT_EDITOR",
  "VIEWER",
] as const;
export type Role = (typeof ROLES)[number];

export const ADMIN_ROLES: Role[] = ["SUPERADMIN", "ADMIN"];
export const CLIENT_ROLES: Role[] = ["CLIENT_OWNER", "CLIENT_EDITOR", "VIEWER"];

export const CLIENT_STATUS = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export type ClientStatus = (typeof CLIENT_STATUS)[number];

export const APPROVAL_MODE = ["AUTO_PUBLISH", "REQUIRES_APPROVAL"] as const;
export type ApprovalMode = (typeof APPROVAL_MODE)[number];

export const DRAFT_STATUS = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PUBLISHED",
  "REJECTED",
] as const;
export type DraftStatus = (typeof DRAFT_STATUS)[number];

export const ITEM_TYPE = ["IMAGE", "VIDEO", "WEBSITE", "URL", "UNKNOWN"] as const;
export type ItemType = (typeof ITEM_TYPE)[number];

export const ITEM_STATUS = ["ACTIVE", "INACTIVE", "EXPIRED"] as const;
export type ItemStatus = (typeof ITEM_STATUS)[number];

export const ASSET_STATUS = ["APPROVED", "PENDING", "REJECTED"] as const;
export type AssetStatus = (typeof ASSET_STATUS)[number];

export function isAdminRole(role: string | undefined | null): boolean {
  return role === "SUPERADMIN" || role === "ADMIN";
}
