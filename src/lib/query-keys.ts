/**
 * TanStack Query key factory — single source of truth for all cache keys.
 *
 * WHY: ad-hoc string arrays scattered across components make cache invalidation
 * fragile. A structured factory lets us:
 *   - Invalidate an entire entity group: `queryClient.invalidateQueries({ queryKey: keys.appointments.all })`
 *   - Invalidate a specific query:       `queryClient.invalidateQueries({ queryKey: keys.appointments.today() })`
 *   - Refetch one record:                `queryClient.invalidateQueries({ queryKey: keys.barbers.detail(id) })`
 *
 * The `as const` assertion preserves literal types so TypeScript catches
 * key mismatches at compile time.
 *
 * RULE: never write a raw array as a queryKey anywhere in the codebase.
 * Always import and use this factory.
 */

export interface AppointmentFilters {
  from?: string
  to?: string
  barberId?: string
  status?: string
}

export const keys = {
  /** Appointment queries — used by today view, calendar, and detail sheet. */
  appointments: {
    all:    ['appointments'] as const,
    list:   (f?: AppointmentFilters) => ['appointments', 'list', f ?? {}] as const,
    today:  () => ['appointments', 'today'] as const,
    detail: (id: string) => ['appointments', 'detail', id] as const,
  },

  /** Barber queries — list used by calendar columns, detail used by schedule sheet. */
  barbers: {
    all:    ['barbers'] as const,
    list:   () => ['barbers', 'list'] as const,
    detail: (id: string) => ['barbers', 'detail', id] as const,
  },

  /** Service catalogue — used by booking flow and services admin page. */
  services: {
    all:    ['services'] as const,
    list:   () => ['services', 'list'] as const,
    detail: (id: string) => ['services', 'detail', id] as const,
  },

  /** Client records — admin only (barber role has no client access). */
  clients: {
    all:    ['clients'] as const,
    list:   (search?: string) => ['clients', 'list', search ?? ''] as const,
    detail: (id: string) => ['clients', 'detail', id] as const,
  },

  /**
   * Slot availability — used by the booking flow and calendar.
   * Keyed by (barberId, serviceId, date) so each barber×service×day is cached
   * independently. Invalidate `keys.availability.all` after any booking or
   * rescheduling to force a fresh slot calculation.
   */
  availability: {
    all:   ['availability'] as const,
    slots: (barberId: string, serviceId: string, date: string) =>
      ['availability', 'slots', barberId, serviceId, date] as const,
  },

  /** Weekly schedule rows per barber — used by the schedule editor sheet. */
  schedules: {
    byBarber: (barberId: string) => ['schedules', barberId] as const,
  },

  /** Vacation / time-off blocks per barber. */
  timeOff: {
    all:      ['time_off'] as const,
    byBarber: (barberId: string) => ['time_off', 'barber', barberId] as const,
  },

  /** Shop configuration (name, address, logo_url, phone, instagram). */
  shop: {
    config: ['shop', 'config'] as const,
  },

  /**
   * Booking page prefetch keys — separate from the authenticated app keys so
   * the public booking flow never shares or pollutes the staff cache.
   */
  bookPage: {
    services: ['book', 'services'] as const,
    barbers:  ['book', 'barbers'] as const,
  },

  /** Discount codes per service — used by the services admin page. */
  discounts: {
    all:       ['discounts'] as const,
    byService: (serviceId: string) => ['discounts', 'service', serviceId] as const,
  },
} as const
