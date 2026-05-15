// Auto-generated shape — keep in sync with schema or run `supabase gen types typescript`
// Usage: supabase = createClient<Database>(url, key)

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled'

export type UserRole = 'admin' | 'barber'

export interface Database {
  public: {
    Tables: {
      barbers: {
        Row: {
          id: string
          name: string
          email: string | null
          photo_url: string | null
          bio: string | null
          color: string
          active: boolean
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          photo_url?: string | null
          bio?: string | null
          color?: string
          active?: boolean
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          photo_url?: string | null
          bio?: string | null
          color?: string
          active?: boolean
        }
      }

      services: {
        Row: {
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
        Insert: {
          id?: string
          name: string
          duration_minutes: number
          price: number
          description?: string | null
          color?: string
          buffer_before_minutes?: number
          buffer_after_minutes?: number
          active?: boolean
        }
        Update: {
          id?: string
          name?: string
          duration_minutes?: number
          price?: number
          description?: string | null
          color?: string
          buffer_before_minutes?: number
          buffer_after_minutes?: number
          active?: boolean
        }
      }

      clients: {
        Row: {
          id: string
          name: string
          phone: string
          email: string | null
          notes: string | null
          preferred_barber_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          phone: string
          email?: string | null
          notes?: string | null
          preferred_barber_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string
          email?: string | null
          notes?: string | null
          preferred_barber_id?: string | null
          created_at?: string
        }
      }

      appointments: {
        Row: {
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
        }
        Insert: {
          id?: string
          client_id: string
          barber_id: string
          service_id: string
          start_time: string
          end_time: string
          status?: AppointmentStatus
          price_charged: number
          notes?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          barber_id?: string
          service_id?: string
          start_time?: string
          end_time?: string
          status?: AppointmentStatus
          price_charged?: number
          notes?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          checked_in_at?: string | null
          created_at?: string
        }
      }

      barber_shops: {
        Row: {
          id: string
          name: string
          currency: string
          locale: string
          timezone: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          currency?: string
          locale?: string
          timezone?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          currency?: string
          locale?: string
          timezone?: string
          created_at?: string
        }
      }

      profiles: {
        Row: {
          id: string
          email: string
          role: UserRole
          barber_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role: UserRole
          barber_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          email?: string
          role?: UserRole
          barber_id?: string | null
          updated_at?: string
        }
      }

      barber_schedules: {
        Row: {
          id: string
          barber_id: string
          day_of_week: number
          start_time: string
          end_time: string
        }
        Insert: {
          id?: string
          barber_id: string
          day_of_week: number
          start_time: string
          end_time: string
        }
        Update: {
          id?: string
          barber_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
        }
      }

      time_off: {
        Row: {
          id: string
          barber_id: string
          start_at: string
          end_at: string
          reason: string | null
        }
        Insert: {
          id?: string
          barber_id: string
          start_at: string
          end_at: string
          reason?: string | null
        }
        Update: {
          id?: string
          barber_id?: string
          start_at?: string
          end_at?: string
          reason?: string | null
        }
      }

      audit_events: {
        Row: {
          id: string
          table_name: string
          record_id: string
          action: string
          payload: Record<string, unknown> | null
          actor: string | null
          created_at: string
        }
        Insert: {
          id?: string
          table_name: string
          record_id: string
          action: string
          payload?: Record<string, unknown> | null
          actor?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          table_name?: string
          record_id?: string
          action?: string
          payload?: Record<string, unknown> | null
          actor?: string | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    CompositeTypes: Record<string, never>
    Enums: {
      appointment_status: AppointmentStatus
    }
  }
}

// Convenience row types
export type DbBarber         = Database['public']['Tables']['barbers']['Row']
export type DbService        = Database['public']['Tables']['services']['Row']
export type DbClient         = Database['public']['Tables']['clients']['Row']
export type DbAppointment    = Database['public']['Tables']['appointments']['Row']
export type DbBarberShop     = Database['public']['Tables']['barber_shops']['Row']
export type DbProfile        = Database['public']['Tables']['profiles']['Row']
export type DbBarberSchedule = Database['public']['Tables']['barber_schedules']['Row']
export type DbTimeOff        = Database['public']['Tables']['time_off']['Row']
