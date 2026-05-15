export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled'

export interface Barber {
  id: string
  name: string
  email: string | null
  photo_url: string | null
  bio: string | null
  color: string
  active: boolean
}

export interface Service {
  id: string
  name: string
  duration_minutes: number
  price: number
  description: string | null
  color: string
  buffer_before_minutes: number
  buffer_after_minutes: number
  active: boolean
}

export interface Client {
  id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  preferred_barber_id: string | null
  created_at: string
}

export interface Appointment {
  id: string
  client_id: string
  barber_id: string
  service_id: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  price_charged: number
  notes: string | null
  cancellation_reason: string | null
  cancelled_at: string | null
  checked_in_at: string | null
  created_at: string
  client?: Client
  barber?: Barber
  service?: Service
}

export interface BarberSchedule {
  id: string
  barber_id: string
  day_of_week: number // 0=Sun, 6=Sat
  start_time: string  // "HH:mm"
  end_time: string
}

export interface TimeOff {
  id: string
  barber_id: string
  start_at: string
  end_at: string
  reason: string | null
}

export interface ServiceDiscount {
  id: string
  service_id: string
  code: string
  label: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  active: boolean
  created_at: string
}

export interface AuditEvent {
  id: string
  table_name: string
  record_id: string
  action: string
  payload: Record<string, unknown> | null
  actor: string | null
  created_at: string
}
