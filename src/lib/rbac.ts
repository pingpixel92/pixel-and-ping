import type { Role } from '@prisma/client'

/**
 * Role-based permission matrix. The backend is the single source of truth —
 * the frontend only mirrors these roles to hide controls.
 */
export const PERMISSIONS = {
  'users:read': ['ADMIN', 'OPERATOR', 'VIEWER'],
  'users:write': ['ADMIN', 'OPERATOR'],
  'infra:read': ['ADMIN', 'OPERATOR', 'VIEWER'],
  'infra:write': ['ADMIN', 'OPERATOR'],
  'cloudflare:manage': ['ADMIN'],
  'settings:manage': ['ADMIN'],
  'apikeys:manage': ['ADMIN'],
  'audit:read': ['ADMIN'],
  'danger:execute': ['ADMIN'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSIONS

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role)
}

export function rolesFor(permission: Permission): Role[] {
  return [...(PERMISSIONS[permission] as readonly Role[])]
}
