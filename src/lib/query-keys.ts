export interface AppointmentFilters {
  from?: string
  to?: string
  barberId?: string
  status?: string
}

export const keys = {
  appointments: {
    all: ['appointments'] as const,
    list: (f?: AppointmentFilters) => ['appointments', 'list', f ?? {}] as const,
    today: () => ['appointments', 'today'] as const,
    detail: (id: string) => ['appointments', 'detail', id] as const,
  },
  barbers: {
    all: ['barbers'] as const,
    list: () => ['barbers', 'list'] as const,
    detail: (id: string) => ['barbers', 'detail', id] as const,
  },
  services: {
    all: ['services'] as const,
    list: () => ['services', 'list'] as const,
    detail: (id: string) => ['services', 'detail', id] as const,
  },
  clients: {
    all: ['clients'] as const,
    list: (search?: string) => ['clients', 'list', search ?? ''] as const,
    detail: (id: string) => ['clients', 'detail', id] as const,
  },
  availability: {
    all: ['availability'] as const,
    slots: (barberId: string, serviceId: string, date: string) =>
      ['availability', 'slots', barberId, serviceId, date] as const,
  },
  schedules: {
    byBarber: (barberId: string) => ['schedules', barberId] as const,
  },
  timeOff: {
    all: ['time_off'] as const,
    byBarber: (barberId: string) => ['time_off', 'barber', barberId] as const,
  },
  shop: {
    config: ['shop', 'config'] as const,
  },
  bookPage: {
    services: ['book', 'services'] as const,
    barbers: ['book', 'barbers'] as const,
  },
  discounts: {
    all: ['discounts'] as const,
    byService: (serviceId: string) => ['discounts', 'service', serviceId] as const,
  },
} as const
