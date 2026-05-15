export type Role = 'admin' | 'barber' | 'customer'
export type Action = 'read' | 'create' | 'update' | 'delete' | 'reschedule' | 'cancel'
export type Resource = 'appointment' | 'barber' | 'service' | 'client' | 'analytics' | 'settings'

const matrix: Record<Role, Partial<Record<Resource, Action[]>>> = {
  admin: {
    appointment: ['read', 'create', 'update', 'delete', 'reschedule', 'cancel'],
    barber: ['read', 'create', 'update', 'delete'],
    service: ['read', 'create', 'update', 'delete'],
    client: ['read', 'create', 'update', 'delete'],
    analytics: ['read'],
    settings: ['read', 'update'],
  },
  barber: {
    appointment: ['read', 'update', 'reschedule', 'cancel'],
    barber: ['read'],
    service: ['read'],
    client: ['read', 'update'],
    analytics: ['read'],
    settings: [],
  },
  customer: {
    appointment: ['read', 'create', 'cancel'],
    barber: ['read'],
    service: ['read'],
    client: [],
    analytics: [],
    settings: [],
  },
}

export function can(role: Role, action: Action, resource: Resource): boolean {
  return matrix[role]?.[resource]?.includes(action) ?? false
}
