/**
 * Role-based access control (RBAC) — application layer.
 *
 * This is the UI-facing permission check. It drives nav visibility and
 * mutation button rendering. It is NOT the security boundary — that is
 * Postgres RLS (`is_admin()` / `is_staff()` policies in migration 004).
 *
 * Usage:
 *   import { can } from '@/lib/can'
 *   if (can(profile.role, 'read', 'client')) { ... }
 *
 * When adding a new resource or action:
 *  1. Add the string literal to the `Resource` or `Action` type below.
 *  2. Update the matrix for every role (explicit empty arrays are intentional —
 *     they document that the omission is deliberate, not forgotten).
 *  3. Add the corresponding RLS policy in a new migration.
 */

export type Role = 'admin' | 'barber' | 'customer'

/** All possible operations a role can perform on a resource. */
export type Action = 'read' | 'create' | 'update' | 'delete' | 'reschedule' | 'cancel'

/** Every protected resource in the app. */
export type Resource = 'appointment' | 'barber' | 'service' | 'client' | 'analytics' | 'settings'

/**
 * Permission matrix — role × resource → allowed actions.
 *
 * Explicit empty arrays mean "this role has zero permissions on this resource".
 * Absent keys fall back to `false` via the `can()` check below.
 */
const matrix: Record<Role, Partial<Record<Resource, Action[]>>> = {
  admin: {
    appointment: ['read', 'create', 'update', 'delete', 'reschedule', 'cancel'],
    barber:      ['read', 'create', 'update', 'delete'],
    service:     ['read', 'create', 'update', 'delete'],
    client:      ['read', 'create', 'update', 'delete'],
    analytics:   ['read'],
    settings:    ['read', 'update'],
  },
  barber: {
    // Barbers are scoped to their own calendar + today view.
    // No shop-wide analytics, no settings, no barber/service management,
    // and critically — no client PII. Enforced at DB level by is_admin() policy.
    appointment: ['read', 'update', 'reschedule', 'cancel'],
    barber:      ['read'],
    service:     ['read'],
    client:      [],   // intentional — barbers cannot read or write client records
    analytics:   [],
    settings:    [],
  },
  customer: {
    // Future role for a client-facing portal (not yet active).
    appointment: ['read', 'create', 'cancel'],
    barber:      ['read'],
    service:     ['read'],
    client:      [],
    analytics:   [],
    settings:    [],
  },
}

/**
 * Returns true if `role` is allowed to perform `action` on `resource`.
 *
 * @example
 *   can('admin',  'read', 'client')       // → true
 *   can('barber', 'read', 'client')       // → false
 *   can('barber', 'read', 'appointment')  // → true
 */
export function can(role: Role, action: Action, resource: Resource): boolean {
  return matrix[role]?.[resource]?.includes(action) ?? false
}
