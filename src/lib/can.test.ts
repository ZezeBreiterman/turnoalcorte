import { describe, it, expect } from 'vitest'
import { can } from './can'
import type { Role, Action, Resource } from './can'

// ── Full role × action × resource matrix ──────────────────────────────────────
// Every entry below is intentional. If can.ts changes, this matrix must change too.

const ACTIONS: Action[] = ['read', 'create', 'update', 'delete', 'reschedule', 'cancel']
const RESOURCES: Resource[] = ['appointment', 'barber', 'service', 'client', 'analytics', 'settings']

type Matrix = Record<Role, Record<Resource, Action[]>>

const EXPECTED: Matrix = {
  admin: {
    appointment: ['read', 'create', 'update', 'delete', 'reschedule', 'cancel'],
    barber:      ['read', 'create', 'update', 'delete'],
    service:     ['read', 'create', 'update', 'delete'],
    client:      ['read', 'create', 'update', 'delete'],
    analytics:   ['read'],
    settings:    ['read', 'update'],
  },
  barber: {
    appointment: ['read', 'update', 'reschedule', 'cancel'],
    barber:      ['read'],
    service:     ['read'],
    client:      [],
    analytics:   [],
    settings:    [],
  },
  customer: {
    appointment: ['read', 'create', 'cancel'],
    barber:      ['read'],
    service:     ['read'],
    client:      [],
    analytics:   [],
    settings:    [],
  },
}

const ROLES: Role[] = ['admin', 'barber', 'customer']

describe('can(role, action, resource)', () => {
  for (const role of ROLES) {
    describe(`role: ${role}`, () => {
      for (const resource of RESOURCES) {
        for (const action of ACTIONS) {
          const allowed = EXPECTED[role][resource].includes(action)
          it(`${allowed ? 'allows' : 'denies'} ${action} on ${resource}`, () => {
            expect(can(role, action, resource)).toBe(allowed)
          })
        }
      }
    })
  }

  // ── Explicit assertions called out by the spec ──────────────────────────────

  describe('explicit anchors', () => {
    it('admin can update settings', () => {
      expect(can('admin', 'update', 'settings')).toBe(true)
    })

    it('barber cannot update settings', () => {
      expect(can('barber', 'update', 'settings')).toBe(false)
    })

    it('barber can read own calendar (appointment)', () => {
      expect(can('barber', 'read', 'appointment')).toBe(true)
    })

    it('customer cannot access admin resources (settings/analytics/client)', () => {
      expect(can('customer', 'read', 'settings')).toBe(false)
      expect(can('customer', 'update', 'settings')).toBe(false)
      expect(can('customer', 'read', 'analytics')).toBe(false)
      expect(can('customer', 'read', 'client')).toBe(false)
      expect(can('customer', 'create', 'client')).toBe(false)
    })

    it('admin has full CRUD on appointments', () => {
      for (const a of ['read', 'create', 'update', 'delete', 'reschedule', 'cancel'] as Action[]) {
        expect(can('admin', a, 'appointment')).toBe(true)
      }
    })

    it('barber cannot read client PII', () => {
      expect(can('barber', 'read', 'client')).toBe(false)
    })
  })
})
