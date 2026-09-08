import { Role } from "@prisma/client";

export { Role };

/**
 * Role hierarchy levels for permission comparisons.
 * OWNER has highest privileges (admin, approvals, pricing, closings).
 * STAFF has operational privileges (sales, receivings, stock movements).
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.OWNER]: 100,
  [Role.STAFF]: 10,
};

/**
 * Checks if the user has the OWNER role.
 */
export function isOwner(role: Role | string | undefined | null): boolean {
  return role === Role.OWNER;
}

/**
 * Checks if the user has the STAFF role.
 */
export function isStaff(role: Role | string | undefined | null): boolean {
  return role === Role.STAFF;
}

/**
 * Checks if the user role meets or exceeds the required role level.
 */
export function hasMinimumRole(userRole: Role, requiredRole: Role): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Checks if the user role is within a list of allowed roles.
 */
export function hasRole(userRole: Role, allowedRoles: Role | Role[]): boolean {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return roles.includes(userRole);
}
