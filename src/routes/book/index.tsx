import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import {
  Check,
  ChevronLeft,
  Scissors,
  Clock,
  User,
  Calendar,
  MapPin,
  Zap,
  Mail,
} from 'lucide-react'
import { format, addDays, getDay } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { resolveAvailableSlots } from '@/features/availability/resolver'
import type { TimeSlot } from '@/features/availability/resolver'
import type { Barber, Service, ShopConfig } from '@/types/database'
import {
  now,
  startOfDay,
  endOfDay,
  formatTime,
  durationLabel,
  formatPrice,
} from '@/lib/time'
import { Input } from '@/components/ui/input'
import { keys } from '@/lib/query-keys'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

// Merged flow: service → pick (barber+date+time) → info → done
type Step = 'service' | 'pick' | 'info' | 'done'

interface BookingState {
  service?: Service
  barber?: Barber  // set when slot is held (auto-assigned or explicit tab choice)
  slot?: TimeSlot
  date?: Date
  name: string
  phone: string
  email: string
  bookingCode?: string
  holdId?: string
  holdExpiresAt?: number // ms epoch
}

// ── Availability hint types ────────────────────────────────────────────────────
type DayHint = 'available' | 'limited' | 'off'

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = '#f97316'
const ACCENT_DARK = '#ea6500'
const SIDEBAR_BG = '#0c0a09'
const SIDEBAR_TEXT = 'rgba(255,255,255,0.9)'
const SIDEBAR_MUTED = 'rgba(255,255,255,0.4)'
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const STEPS: Step[] = ['service', 'pick', 'info', 'done']

const STEP_META: Record<Step, { title: string; sub: string; sideLabel: string }> = {
  service: { title: '¿Qué servicio querés?',   sub: 'Elegí el tipo de corte o tratamiento.',   sideLabel: 'Servicio'  },
  pick:    { title: '¿Cuándo te viene bien?',  sub: 'Elegí barbero, día y horario disponible.', sideLabel: 'Turno'     },
  info:    { title: '¿Cómo te llamamos?',      sub: 'Tus datos para confirmar el turno.',       sideLabel: 'Tus datos' },
  done:    { title: '',                         sub: '',                                          sideLabel: ''          },
}

// ── Animation variants ────────────────────────────────────────────────────────

const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 120, damping: 20 } },
}

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0, transition: { type: 'spring' as const, stiffness: 140, damping: 22 } },
  exit:  (dir: number) => ({ opacity: 0, x: dir > 0 ? -28 : 28, transition: { duration: 0.18 } }),
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchShopConfig(): Promise<ShopConfig> {
  const { data, error } = await supabase
    .from('shop_config')
    .select('*')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data ?? { id: '', name: 'Turnoalcorte', logo_url: null, address: null, phone: null, description: null, instagram: null }) as ShopConfig
}

async function fetchServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Service[]
}

async function fetchBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from('barbers')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Barber[]
}

async function fetchSlotsForDay(barberId: string, service: Service, date: Date): Promise<TimeSlot[]> {
  const dayOfWeek = getDay(date)
  const [scheduleRes, timeOffRes, apptRes, holdRes] = await Promise.all([
    supabase.from('barber_schedules').select('day_of_week, start_time, end_time')
      .eq('barber_id', barberId).eq('day_of_week', dayOfWeek).maybeSingle(),
    supabase.from('time_off').select('start_at, end_at')
      .eq('barber_id', barberId)
      .lte('start_at', endOfDay(date).toISOString())
      .gte('end_at', startOfDay(date).toISOString()),
    // PII-free public view (RLS: anon has no direct access to `appointments`)
    supabase.from('appointments_public').select('start_time, end_time')
      .eq('barber_id', barberId)
      .gte('start_time', startOfDay(date).toISOString())
      .lte('start_time', endOfDay(date).toISOString()),
    // Active holds — slots someone else is mid-booking
    supabase.from('slot_holds_public').select('start_time, end_time')
      .eq('barber_id', barberId)
      .gte('start_time', startOfDay(date).toISOString())
      .lte('start_time', endOfDay(date).toISOString()),
  ])
  return resolveAvailableSlots({
    date,
    serviceDuration: service.duration_minutes,
    serviceBufferBefore: service.buffer_before_minutes ?? 0,
    serviceBufferAfter: service.buffer_after_minutes ?? 10,
    schedule: scheduleRes.data ?? null,
    timeOff: timeOffRes.data ?? [],
    booked: [
      ...(apptRes.data ?? []).map((a) => ({
        start_time: a.start_time,
        end_time: a.end_time,
        buffer_before_minutes: 0,
        buffer_after_minutes: 10,
      })),
      ...(holdRes.data ?? []).map((h) => ({
        start_time: h.start_time,
        end_time: h.end_time,
        buffer_before_minutes: 0,
        buffer_after_minutes: 0,
      })),
    ],
  })
}

// Lightweight hint for 14-day strip.
// 3 DB queries: schedule + time_off + actual appointment counts for accuracy.
// Dot = green (4+ free slots), orange (1-3 free slots), none (fully booked/off-day).
async function fetchAvailabilityHints(
  barberIds: string[],
  service: Service,
  days: Date[],
): Promise<Map<string, DayHint>> {
  if (barberIds.length === 0 || days.length === 0) return new Map()
  const rangeStart = days[0]
  const rangeEnd = days[days.length - 1]
  const [scheduleRes, timeOffRes, apptRes] = await Promise.all([
    supabase.from('barber_schedules')
      .select('barber_id, day_of_week, start_time, end_time')
      .in('barber_id', barberIds),
    supabase.from('time_off')
      .select('barber_id, start_at, end_at')
      .in('barber_id', barberIds)
      .lte('start_at', endOfDay(rangeEnd).toISOString())
      .gte('end_at', startOfDay(rangeStart).toISOString()),
    // Actual booked-slot counts so dots reflect remaining capacity, not theoretical max
    supabase.from('appointments_public')
      .select('barber_id, start_time')
      .in('barber_id', barberIds)
      .gte('start_time', startOfDay(rangeStart).toISOString())
      .lte('start_time', endOfDay(rangeEnd).toISOString()),
  ])
  const schedules = scheduleRes.data ?? []
  const timeOffs = timeOffRes.data ?? []
  // Build booked-count map: "barberId:yyyy-MM-dd" → count
  const bookedMap = new Map<string, number>()
  for (const a of (apptRes.data ?? [])) {
    const dateKey = format(new Date(a.start_time as string), 'yyyy-MM-dd')
    const mapKey = (a.barber_id as string) + ':' + dateKey
    bookedMap.set(mapKey, (bookedMap.get(mapKey) ?? 0) + 1)
  }
  const result = new Map<string, DayHint>()
  for (const day of days) {
    const key = format(day, 'yyyy-MM-dd')
    const dow = day.getDay()
    let maxAvailable = 0
    for (const bid of barberIds) {
      const sched = schedules.find(s => s.barber_id === bid && s.day_of_week === dow)
      if (!sched) continue
      const fullyBlocked = timeOffs.some(
        to => to.barber_id === bid &&
          new Date(to.start_at) <= startOfDay(day) &&
          new Date(to.end_at) >= endOfDay(day),
      )
      if (fullyBlocked) continue
      const [sh, sm] = (sched.start_time as string).split(':').map(Number)
      const [eh, em] = (sched.end_time as string).split(':').map(Number)
      const workMin = (eh * 60 + em) - (sh * 60 + sm)
      const slotSize = service.duration_minutes + (service.buffer_after_minutes ?? 10)
      const maxSlots = Math.floor(workMin / slotSize)
      const booked = bookedMap.get(bid + ':' + key) ?? 0
      maxAvailable = Math.max(maxAvailable, Math.max(0, maxSlots - booked))
    }
    result.set(key, maxAvailable === 0 ? 'off' : maxAvailable <= 3 ? 'limited' : 'available')
  }
  return result
}

// Fetch slots for multiple barbers in parallel.
async function fetchSlotsForBarbers(
  barbers: Barber[],
  service: Service,
  date: Date,
): Promise<Record<string, TimeSlot[]>> {
  const entries = await Promise.all(
    barbers.map(async b => [b.id, await fetchSlotsForDay(b.id, service, date)] as const),
  )
  return Object.fromEntries(entries)
}

// Filter barbers who can perform a given service.
// Falls back to all barbers if the assignment table is empty or not populated.
async function fetchBarbersByService(serviceId: string, allBarbers: Barber[]): Promise<Barber[]> {
  try {
    const { data, error } = await supabase
      .from('staff_service_assignments')
      .select('barber_id')
      .eq('service_id', serviceId)
    if (error || !data || data.length === 0) return allBarbers
    const ids = new Set((data as { barber_id: string }[]).map(r => r.barber_id))
    const filtered = allBarbers.filter(b => ids.has(b.id))
    return filtered.length > 0 ? filtered : allBarbers
  } catch {
    return allBarbers
  }
}

// ── Magnetic CTA Button ───────────────────────────────────────────────────────

function MagneticButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 200, damping: 20 })
  const springY = useSpring(y, { stiffness: 200, damping: 20 })

  function handleMouseMove(e: React.MouseEvent<HTMLButtonElement>) {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    x.set((e.clientX - cx) * 0.28)
    y.set((e.clientY - cy) * 0.28)
  }

  function handleMouseLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'w-full h-14 rounded-2xl text-sm font-semibold transition-opacity duration-150',
        'flex items-center justify-center gap-2 relative overflow-hidden',
        disabled
          ? 'opacity-30 cursor-not-allowed'
          : 'cursor-pointer',
      )}
      style={{
        x: springX,
        y: springY,
        background: disabled ? '#e5e7eb' : `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
        color: disabled ? '#9ca3af' : '#fff',
        boxShadow: disabled ? 'none' : `0 4px 24px -4px ${ACCENT}60`,
      }}
    >
      {loading ? (
        <span className="size-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        children
      )}
    </motion.button>
  )
}

// ── Day strip ─────────────────────────────────────────────────────────────────

function DayStrip({
  selected,
  onSelect,
  hints,
}: {
  selected: Date | undefined
  onSelect: (d: Date) => void
  hints?: Map<string, DayHint>
}) {
  const days = Array.from({ length: 14 }, (_, i) => startOfDay(addDays(now(), i)))
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
      style={{ scrollbarWidth: 'none' }}>
      {days.map((day) => {
        const key = format(day, 'yyyy-MM-dd')
        const isSelected = selected && format(selected, 'yyyy-MM-dd') === key
        const isNow = key === format(now(), 'yyyy-MM-dd')
        const hint = hints?.get(key)
        const isOff = hint === 'off'
        return (
          <motion.button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelect(day)}
            whileTap={{ scale: 0.93 }}
            disabled={isOff}
            className={cn(
              'flex flex-col items-center shrink-0 w-13 min-w-[52px] rounded-2xl py-2.5 px-1.5 border transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2',
              isOff && !isSelected
                ? 'opacity-35 cursor-not-allowed border-[var(--color-border)]'
                : isSelected
                  ? 'text-white border-transparent'
                  : isNow
                    ? 'border-[var(--color-primary)]/60 text-[var(--color-primary)]'
                    : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]'
            )}
            style={isSelected ? { backgroundColor: ACCENT, borderColor: ACCENT } : {}}
          >
            <span className="text-[9px] font-bold uppercase leading-none mb-1.5 tracking-wider opacity-80">
              {DAY_LABELS[day.getDay()]}
            </span>
            <span className="text-lg font-bold leading-none tabular-nums">{day.getDate()}</span>
            <span className="text-[9px] leading-none mt-1 opacity-70 uppercase tracking-wider">
              {MONTH_LABELS[day.getMonth()]}
            </span>
            {/* Availability dot */}
            <div className="h-1 mt-1 flex items-center justify-center">
              {!isSelected && hint && hint !== 'off' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="size-1 rounded-full"
                  style={{ backgroundColor: hint === 'limited' ? '#f97316' : '#22c55e' }}
                />
              )}
            </div>
          </motion.button>
        )
      })}
    </div>
  )
}

// ── Step: Service ─────────────────────────────────────────────────────────────

function StepService({ services, selected, onSelect }: {
  services: Service[]
  selected?: Service
  onSelect: (s: Service) => void
}) {
  return (
    <motion.div variants={listVariants} initial="hidden" animate="show" className="space-y-2.5">
      {services.map((s) => {
        const isSelected = selected?.id === s.id
        const color = s.color ?? '#8b5cf6'
        return (
          <motion.button
            key={s.id}
            variants={itemVariants}
            type="button"
            onClick={() => onSelect(s)}
            whileTap={{ scale: 0.985 }}
            className={cn(
              'w-full flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200',
              'focus-visible:outline-none focus-visible:ring-2',
              isSelected
                ? 'shadow-sm'
                : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-border-strong)] hover:shadow-sm'
            )}
            style={isSelected ? {
              borderColor: color + '80',
              backgroundColor: color + '08',
              boxShadow: `0 0 0 1px ${color}30, 0 2px 8px -2px ${color}20`,
            } : {}}
          >
            {/* Left accent bar */}
            <div
              className="w-0.5 h-10 rounded-full shrink-0 transition-all duration-200"
              style={{ backgroundColor: isSelected ? color : 'transparent' }}
            />

            <div
              className="size-10 rounded-xl shrink-0 flex items-center justify-center transition-all duration-200"
              style={{ backgroundColor: color + '18' }}
            >
              <Scissors className="size-4" style={{ color }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--color-fg)]">{s.name}</p>
              {s.description && (
                <p className="text-xs text-[var(--color-fg-muted)] truncate mt-0.5">{s.description}</p>
              )}
            </div>

            <div className="text-right shrink-0 space-y-0.5">
              <p className="text-sm font-bold text-[var(--color-fg)] font-[var(--font-mono)] tabular-nums">
                {formatPrice(s.price)}
              </p>
              <p className="text-xs text-[var(--color-fg-muted)] flex items-center gap-1 justify-end">
                <Clock className="size-3" />
                {durationLabel(s.duration_minutes)}
              </p>
            </div>

            <AnimatePresence>
              {isSelected && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="size-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: color }}
                >
                  <Check className="size-3 text-white" strokeWidth={2.5} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        )
      })}
    </motion.div>
  )
}

// ── Step: Pick (unified barber + date + time) ─────────────────────────────────
// Replaces separate barber and datetime steps.
// - Barber filter tabs: "Cualquiera" (auto-assign) + one per barber filtered by service
// - Day strip: availability hints via 2 DB queries, today auto-selected on mount
// - Time slots: parallel per-barber fetch; badge shows how many barbers share a slot
// - Barber assignment happens on slot click (auto or explicit tab)

function StepPick({
  allBarbers,
  service,
  selectedDate,
  selectedSlot,
  isHolding,
  onDateSelect,
  onSlotSelect,
}: {
  allBarbers: Barber[]
  service: Service
  selectedDate?: Date
  selectedSlot?: TimeSlot
  isHolding?: boolean
  onDateSelect: (d: Date) => void
  onSlotSelect: (s: TimeSlot, barber: Barber) => void
}) {
  const [viewingBarberId, setViewingBarberId] = useState<string | 'any'>('any')

  // Auto-select today on mount so slots appear immediately
  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (!autoSelectedRef.current && !selectedDate) {
      autoSelectedRef.current = true
      onDateSelect(startOfDay(now()))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset tab when service changes (filtered barber list may differ)
  useEffect(() => { setViewingBarberId('any') }, [service.id])

  // Filter barbers eligible for this service
  const { data: filteredBarbers = allBarbers } = useQuery({
    queryKey: ['book', 'barbers-for-service', service.id],
    queryFn: () => fetchBarbersByService(service.id, allBarbers),
    enabled: allBarbers.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  const viewingBarber: Barber | null =
    viewingBarberId === 'any' ? null : (filteredBarbers.find(b => b.id === viewingBarberId) ?? null)

  // 14-day availability hints (2 DB queries, cached 5 min)
  const days = Array.from({ length: 14 }, (_, i) => startOfDay(addDays(now(), i)))
  const barberIds = filteredBarbers.map(b => b.id)
  const { data: hints } = useQuery({
    queryKey: ['book', 'hints', ...barberIds, service.id],
    queryFn: () => fetchAvailabilityHints(barberIds, service, days),
    staleTime: 5 * 60 * 1000,
    enabled: barberIds.length > 0,
  })

  // Time slots: one barber or all in parallel
  const { data: slotsByBarber = {}, isLoading, isFetching } = useQuery({
    queryKey: ['book', 'slots', viewingBarber?.id ?? 'any', ...barberIds, service.id, selectedDate?.toISOString() ?? ''],
    queryFn: () => {
      if (!selectedDate) return {} as Record<string, TimeSlot[]>
      if (viewingBarber) {
        return fetchSlotsForDay(viewingBarber.id, service, selectedDate)
          .then(s => ({ [viewingBarber.id]: s }))
      }
      return fetchSlotsForBarbers(filteredBarbers, service, selectedDate)
    },
    enabled: !!selectedDate && barberIds.length > 0,
  })

  // Merge unique slots for 'any' view
  const displaySlots: TimeSlot[] = viewingBarber
    ? (slotsByBarber[viewingBarber.id] ?? [])
    : (() => {
        const seen = new Set<string>()
        return Object.values(slotsByBarber)
          .flat()
          .filter(s => { const k = s.startAt.toISOString(); if (seen.has(k)) return false; seen.add(k); return true })
          .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      })()

  // Auto-assign: pick barber with most remaining slots (most available = least booked)
  function resolveBarber(slot: TimeSlot): Barber | null {
    if (viewingBarber) return viewingBarber
    const k = slot.startAt.toISOString()
    const candidates = filteredBarbers.filter(b =>
      (slotsByBarber[b.id] ?? []).some(s => s.startAt.toISOString() === k),
    )
    if (candidates.length === 0) return filteredBarbers[0] ?? null
    return candidates.reduce((best, b) =>
      (slotsByBarber[b.id]?.length ?? 0) > (slotsByBarber[best.id]?.length ?? 0) ? b : best,
    )
  }

  function handleSlotClick(slot: TimeSlot) {
    const barber = resolveBarber(slot)
    if (!barber) {
      toast.error('No hay barberos disponibles para este servicio')
      return
    }
    onSlotSelect(slot, barber)
  }

  function barberCountForSlot(slot: TimeSlot): number {
    if (viewingBarberId !== 'any') return 1
    const k = slot.startAt.toISOString()
    return filteredBarbers.filter(b => (slotsByBarber[b.id] ?? []).some(s => s.startAt.toISOString() === k)).length
  }

  return (
    <div className="space-y-6">
      {/* ── Barber filter tabs ──────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-fg-muted)] mb-3">
          Barbero
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          <button
            type="button"
            onClick={() => setViewingBarberId('any')}
            className={cn(
              'shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-xs font-semibold transition-all duration-150 focus-visible:outline-none',
              viewingBarberId === 'any'
                ? 'text-white border-transparent'
                : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]',
            )}
            style={viewingBarberId === 'any' ? { backgroundColor: ACCENT } : {}}
          >
            <Zap className="size-3" />
            Cualquiera
          </button>
          {filteredBarbers.map(b => {
            const active = viewingBarberId === b.id
            const color = b.color ?? '#6366f1'
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setViewingBarberId(b.id)}
                className={cn(
                  'shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-xs font-semibold transition-all duration-150 focus-visible:outline-none',
                  active
                    ? 'text-white border-transparent'
                    : 'border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)]',
                )}
                style={active ? { backgroundColor: color } : {}}
              >
                <div
                  className="size-4 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[8px] font-bold text-white"
                  style={{ backgroundColor: active ? 'rgba(255,255,255,0.3)' : color }}
                >
                  {b.photo_url
                    ? <img src={b.photo_url} alt={b.name} className="size-full object-cover" />
                    : b.name.charAt(0)
                  }
                </div>
                {b.name.split(' ')[0]}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Day strip ───────────────────────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-fg-muted)] mb-3">
          Día
        </p>
        <DayStrip selected={selectedDate} onSelect={onDateSelect} hints={hints} />
      </div>

      {/* ── Time slots ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-fg-muted)]">
                Horarios disponibles
              </p>
              {viewingBarberId === 'any' && displaySlots.length > 0 && (
                <p className="text-[10px] text-[var(--color-fg-subtle)]">
                  Barbero asignado automáticamente
                </p>
              )}
            </div>
            {(isLoading || isFetching) ? (
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-11 w-16 rounded-xl bg-[var(--color-bg-subtle)] animate-pulse" />
                ))}
              </div>
            ) : displaySlots.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center">
                <Clock className="size-5 mx-auto text-[var(--color-fg-subtle)] mb-2" />
                <p className="text-sm font-medium text-[var(--color-fg-muted)]">Sin turnos disponibles</p>
                <p className="text-xs text-[var(--color-fg-subtle)] mt-1">Probá con otro día</p>
              </div>
            ) : (
              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="show"
                className="flex flex-wrap gap-2"
              >
                {displaySlots.map((slot) => {
                  const isSelected = selectedSlot?.startAt.toISOString() === slot.startAt.toISOString()
                  const count = barberCountForSlot(slot)
                  return (
                    <motion.button
                      key={slot.startAt.toISOString()}
                      variants={itemVariants}
                      type="button"
                      onClick={() => handleSlotClick(slot)}
                      disabled={isHolding}
                      whileTap={{ scale: 0.93 }}
                      className={cn(
                        'relative h-11 px-3.5 rounded-xl border text-xs font-semibold transition-all duration-150',
                        'focus-visible:outline-none tabular-nums font-[var(--font-mono)]',
                        isHolding && 'opacity-50 cursor-not-allowed',
                        isSelected
                          ? 'text-white border-transparent'
                          : 'border-[var(--color-border)] text-[var(--color-fg)] hover:border-[var(--color-primary)]/60',
                      )}
                      style={isSelected ? {
                        backgroundColor: ACCENT,
                        borderColor: ACCENT,
                        boxShadow: `0 2px 12px -2px ${ACCENT}50`,
                      } : {}}
                    >
                      {formatTime(slot.startAt)}
                      {count > 1 && !isSelected && (
                        <span
                          className="absolute -top-1.5 -right-1.5 size-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
                          style={{ backgroundColor: '#22c55e' }}
                        >
                          {count}
                        </span>
                      )}
                    </motion.button>
                  )
                })}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Step: Info ────────────────────────────────────────────────────────────────

function StepInfo({ name, phone, email, onChangeName, onChangePhone, onChangeEmail, errors }: {
  name: string
  phone: string
  email: string
  onChangeName: (v: string) => void
  onChangePhone: (v: string) => void
  onChangeEmail: (v: string) => void
  errors: { name?: string; phone?: string; email?: string }
}) {
  return (
    <motion.div
      variants={listVariants}
      initial="hidden"
      animate="show"
      className="space-y-5"
    >
      <motion.div variants={itemVariants} className="space-y-1.5">
        <label htmlFor="book-name" className="block text-xs font-semibold text-[var(--color-fg-muted)] uppercase tracking-wider">
          Nombre completo
        </label>
        <Input
          id="book-name"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="Tu nombre completo"
          error={!!errors.name}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'book-name-error' : undefined}
          autoComplete="name"
          className="h-12 text-sm"
        />
        {errors.name && (
          <p id="book-name-error" role="alert" className="text-xs text-[var(--color-danger)]">{errors.name}</p>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <label htmlFor="book-phone" className="block text-xs font-semibold text-[var(--color-fg-muted)] uppercase tracking-wider">
          Teléfono
        </label>
        <Input
          id="book-phone"
          value={phone}
          onChange={(e) => onChangePhone(e.target.value)}
          placeholder="+54 11 1234-5678"
          type="tel"
          error={!!errors.phone}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'book-phone-error' : 'book-phone-hint'}
          autoComplete="tel"
          className="h-12 text-sm"
        />
        {errors.phone ? (
          <p id="book-phone-error" role="alert" className="text-xs text-[var(--color-danger)]">{errors.phone}</p>
        ) : (
          <p id="book-phone-hint" className="text-xs text-[var(--color-fg-subtle)]">
            Te enviamos el recordatorio por WhatsApp.
          </p>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-1.5">
        <label htmlFor="book-email" className="block text-xs font-semibold text-[var(--color-fg-muted)] uppercase tracking-wider">
          Email <span className="normal-case text-[var(--color-fg-subtle)] font-normal">(opcional)</span>
        </label>
        <Input
          id="book-email"
          value={email}
          onChange={(e) => onChangeEmail(e.target.value)}
          placeholder="tu@email.com"
          type="email"
          error={!!errors.email}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'book-email-error' : 'book-email-hint'}
          autoComplete="email"
          className="h-12 text-sm"
        />
        {errors.email ? (
          <p id="book-email-error" role="alert" className="text-xs text-[var(--color-danger)]">{errors.email}</p>
        ) : (
          <p id="book-email-hint" className="text-xs text-[var(--color-fg-subtle)]">
            Te mandamos una confirmación con los detalles del turno.
          </p>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Step: Done (Ticket) ───────────────────────────────────────────────────────

function StepDone({ booking, code, shop }: { booking: BookingState; code: string; shop: ShopConfig }) {
  return (
    <div className="flex flex-col items-center gap-6 py-2">
      {/* Animated check */}
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 14, stiffness: 220, delay: 0.1 }}
        className="relative"
      >
        <div
          className="size-20 rounded-full flex items-center justify-center"
          style={{ backgroundColor: ACCENT }}
        >
          <Check className="size-9 text-white" strokeWidth={3} />
        </div>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: ACCENT }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="text-center"
      >
        <h2 className="text-2xl font-bold text-[var(--color-fg)] tracking-tight">
          ¡Turno confirmado!
        </h2>
        <p className="text-sm text-[var(--color-fg-muted)] mt-1">
          Te esperamos, <span className="font-semibold text-[var(--color-fg)]">{booking.name.split(' ')[0]}</span>.
        </p>
      </motion.div>

      {/* Ticket card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20, delay: 0.35 }}
        className="w-full"
      >
        {/* Ticket body */}
        <div className="rounded-3xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)]"
          style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.08)' }}>
          {/* Ticket header strip */}
          <div className="px-5 py-4 flex items-center gap-3"
            style={{ background: `linear-gradient(135deg, ${ACCENT}15, ${ACCENT}05)`, borderBottom: `1px solid ${ACCENT}20` }}>
            <div className="size-8 rounded-xl overflow-hidden shrink-0">
              <img src={shop.logo_url ?? '/favicon.png'} alt={shop.name} className="size-full object-cover" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: ACCENT }}>
                {shop.name}
              </p>
              <p className="text-[10px] text-[var(--color-fg-muted)]">Confirmación de reserva</p>
            </div>
          </div>

          {/* Ticket rows */}
          <div className="divide-y divide-[var(--color-border)]">
            <TicketRow icon={<Scissors className="size-3.5" />} label="Servicio" value={booking.service?.name ?? ''} />
            <TicketRow icon={<User className="size-3.5" />}     label="Barbero"  value={booking.barber?.name ?? ''} />
            <TicketRow
              icon={<Calendar className="size-3.5" />}
              label="Fecha"
              value={booking.date ? format(booking.date, "EEEE d 'de' MMMM") : ''}
            />
            <TicketRow
              icon={<Clock className="size-3.5" />}
              label="Hora"
              value={booking.slot ? `${formatTime(booking.slot.startAt)} – ${formatTime(booking.slot.endAt)}` : ''}
            />
            {booking.email && (
              <TicketRow icon={<Mail className="size-3.5" />} label="Email" value={booking.email} />
            )}
          </div>

          {/* Perforated divider */}
          <div className="relative flex items-center my-0">
            <div className="absolute -left-3 size-6 rounded-full border border-[var(--color-border)]"
              style={{ backgroundColor: 'var(--color-bg-muted)' }} />
            <div className="flex-1 mx-4 border-t-2 border-dashed border-[var(--color-border)]" />
            <div className="absolute -right-3 size-6 rounded-full border border-[var(--color-border)]"
              style={{ backgroundColor: 'var(--color-bg-muted)' }} />
          </div>

          {/* Booking code */}
          <div className="px-5 py-5 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-fg-muted)] mb-2">
              Código de reserva
            </p>
            <p
              className="text-3xl font-bold tracking-[0.3em] font-[var(--font-mono)] tabular-nums"
              style={{ color: ACCENT }}
            >
              {code.toUpperCase()}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex flex-col items-center gap-1 text-xs text-[var(--color-fg-subtle)]"
      >
        <span>Guardá este código como comprobante.</span>
        {shop.address && (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            {shop.address}
          </span>
        )}
        {shop.phone && (
          <a href={`tel:${shop.phone}`} className="hover:underline" style={{ color: ACCENT }}>
            {shop.phone}
          </a>
        )}
      </motion.div>
    </div>
  )
}

function TicketRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-[var(--color-fg-subtle)]">{icon}</span>
      <span className="text-xs text-[var(--color-fg-muted)] w-16 shrink-0">{label}</span>
      <span className="text-sm font-medium text-[var(--color-fg)] flex-1 text-right capitalize">{value}</span>
    </div>
  )
}

// ── Left sidebar ──────────────────────────────────────────────────────────────

function LeftSidebar({ step, booking, shop }: { step: Step; booking: BookingState; shop: ShopConfig }) {
  const stepIdx = STEPS.indexOf(step)

  return (
    <div
      className="hidden md:flex flex-col h-full px-10 py-10 justify-between"
      style={{ backgroundColor: SIDEBAR_BG }}
    >
      {/* Brand */}
      <div>
        <div className="flex items-center gap-2.5 mb-12">
          <div className="size-9 rounded-xl overflow-hidden shrink-0">
            <img src={shop.logo_url ?? '/favicon.png'} alt={shop.name} className="size-full object-cover" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold tracking-tight block" style={{ color: SIDEBAR_TEXT }}>
              {shop.name}
            </span>
            {shop.address && (
              <span className="text-[10px] block truncate" style={{ color: SIDEBAR_MUTED }}>
                {shop.address}
              </span>
            )}
          </div>
        </div>

        {/* Step progress (vertical) */}
        <div className="space-y-1">
          {STEPS.slice(0, -1).map((s, i) => {
            const isActive = s === step
            const isDone = stepIdx > i
            return (
              <div
                key={s}
                className="flex items-center gap-3 py-2"
                aria-current={isActive ? 'step' : undefined}
              >
                <div className="relative flex items-center justify-center size-5 shrink-0">
                  <AnimatePresence mode="wait">
                    {isDone ? (
                      <motion.div
                        key="done"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        className="size-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: ACCENT }}
                      >
                        <Check className="size-2.5 text-white" strokeWidth={3} />
                      </motion.div>
                    ) : isActive ? (
                      <motion.div
                        key="active"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="size-5 rounded-full border-2 flex items-center justify-center"
                        style={{ borderColor: ACCENT }}
                      >
                        <div className="size-1.5 rounded-full" style={{ backgroundColor: ACCENT }} />
                      </motion.div>
                    ) : (
                      <div key="idle" className="size-5 rounded-full border-2"
                        style={{ borderColor: 'rgba(255,255,255,0.12)' }} />
                    )}
                  </AnimatePresence>
                </div>
                <span
                  className="text-xs font-medium transition-colors duration-200"
                  style={{ color: isActive ? SIDEBAR_TEXT : isDone ? SIDEBAR_MUTED : 'rgba(255,255,255,0.22)' }}
                >
                  {STEP_META[s].sideLabel}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected context */}
      <div className="space-y-3">
        <AnimatePresence>
          {booking.service && (
            <motion.div
              key="service-ctx"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              className="rounded-2xl p-3.5"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1"
                style={{ color: SIDEBAR_MUTED }}>Servicio</p>
              <p className="text-sm font-semibold" style={{ color: SIDEBAR_TEXT }}>
                {booking.service.name}
              </p>
              <p className="text-xs mt-0.5 font-[var(--font-mono)]" style={{ color: ACCENT }}>
                {formatPrice(booking.service.price)} · {durationLabel(booking.service.duration_minutes)}
              </p>
            </motion.div>
          )}

          {booking.barber && (
            <motion.div
              key="barber-ctx"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              className="flex items-center gap-3 rounded-2xl p-3.5"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <div
                className="size-8 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: booking.barber.color ?? '#6366f1' }}
              >
                {booking.barber.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
                  style={{ color: SIDEBAR_MUTED }}>Barbero</p>
                <p className="text-sm font-semibold truncate" style={{ color: SIDEBAR_TEXT }}>
                  {booking.barber.name}
                </p>
              </div>
            </motion.div>
          )}

          {booking.slot && booking.date && (
            <motion.div
              key="slot-ctx"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              className="rounded-2xl p-3.5"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1"
                style={{ color: SIDEBAR_MUTED }}>Fecha y hora</p>
              <p className="text-sm font-semibold capitalize" style={{ color: SIDEBAR_TEXT }}>
                {format(booking.date, "EEEE d 'de' MMMM")}
              </p>
              <p className="text-xs mt-0.5 font-[var(--font-mono)]" style={{ color: ACCENT }}>
                {formatTime(booking.slot.startAt)} – {formatTime(booking.slot.endAt)}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookPage() {
  const [step, setStep] = useState<Step>('service')
  const [dir, setDir] = useState(1)
  const [booking, setBooking] = useState<BookingState>({ name: '', phone: '', email: '' })
  const [infoErrors, setInfoErrors] = useState<{ name?: string; phone?: string; email?: string }>({})
  const [holdRemaining, setHoldRemaining] = useState<number | null>(null) // seconds

  const { data: shop = { id: '', name: 'Turnoalcorte', logo_url: null, address: null, phone: null, description: null, instagram: null } as ShopConfig } = useQuery({ queryKey: keys.shop.config, queryFn: fetchShopConfig })
  const { data: services = [] } = useQuery({ queryKey: keys.bookPage.services, queryFn: fetchServices })
  const { data: barbers = [] } = useQuery({ queryKey: keys.bookPage.barbers, queryFn: fetchBarbers })

  const queryClient = useQueryClient()

  const { mutate: confirm, isPending } = useMutation({
    mutationFn: async () => {
      if (!booking.service || !booking.barber || !booking.slot) throw new Error('Missing data')
      // Secure server-side booking: client upsert + appointment insert + price
      // are all done in the book_appointment SECURITY DEFINER RPC. Anon has no
      // direct access to the clients/appointments tables (RLS).
      const { data, error } = await supabase.rpc('book_appointment', {
        p_barber_id: booking.barber.id,
        p_service_id: booking.service.id,
        p_start: booking.slot.startAt.toISOString(),
        p_end: booking.slot.endAt.toISOString(),
        p_name: booking.name,
        p_phone: booking.phone,
        p_email: booking.email.trim() || null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: (id: string) => {
      const code = id.replace(/-/g, '').slice(-6)
      // Clearing holdId triggers the release effect below (single source of truth).
      setBooking((b) => ({ ...b, bookingCode: code, holdId: undefined, holdExpiresAt: undefined }))
      setDir(1)
      setStep('done')
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('slot_taken')) {
        // Someone grabbed this slot between availability check and confirm.
        toast.error('Ese turno se acaba de ocupar. Elegí otro horario.')
        queryClient.invalidateQueries({ queryKey: keys.availability.all })
        setBooking((b) => ({ ...b, slot: undefined, holdId: undefined, holdExpiresAt: undefined }))
        setDir(-1)
        setStep('pick')
      } else if (msg.includes('service_unavailable')) {
        toast.error('Ese servicio ya no está disponible.')
      } else {
        toast.error('No pudimos confirmar el turno. Intentá de nuevo.')
      }
    },
  })

  const releaseHold = useCallback((holdId?: string) => {
    if (holdId) void supabase.rpc('release_slot', { p_hold_id: holdId })
  }, [])

  // Select a slot → place a 10-min server-side hold so nobody else can take it
  // while the customer fills the form.
  // Accepts explicit barber (needed for noPreference auto-assignment).
  const { mutate: holdSlot, isPending: isHolding } = useMutation({
    mutationFn: async ({ slot, barber }: { slot: TimeSlot; barber: Barber }) => {
      const { data, error } = await supabase.rpc('hold_slot', {
        p_barber_id: barber.id,
        p_start: slot.startAt.toISOString(),
        p_end: slot.endAt.toISOString(),
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return { slot, barber, holdId: row.hold_id as string, expiresAt: new Date(row.expires_at).getTime() }
    },
    onSuccess: ({ slot, barber, holdId, expiresAt }) => {
      // Switching holdId auto-releases the previous hold via the effect below.
      // Also store the (auto-)assigned barber here.
      setBooking((b) => ({ ...b, slot, barber, holdId, holdExpiresAt: expiresAt }))
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('slot_taken')) {
        toast.error('Ese horario se acaba de ocupar. Probá con otro.')
        queryClient.invalidateQueries({ queryKey: keys.availability.all })
      } else {
        toast.error('No pudimos reservar el horario. Intentá de nuevo.')
      }
      setBooking((b) => ({ ...b, slot: undefined, holdId: undefined, holdExpiresAt: undefined }))
    },
  })

  // Countdown: tick every second; when the hold expires, drop the slot and
  // bounce back to slot selection.
  useEffect(() => {
    if (!booking.holdExpiresAt || step === 'done') {
      setHoldRemaining(null)
      return
    }
    const tick = () => {
      const secs = Math.round((booking.holdExpiresAt! - Date.now()) / 1000)
      if (secs <= 0) {
        setHoldRemaining(0)
        // Clearing holdId releases the expired hold via the effect below.
        setBooking((b) => ({ ...b, slot: undefined, holdId: undefined, holdExpiresAt: undefined }))
        toast.error('La reserva del horario expiró. Elegí otro turno.')
        setDir(-1)
        setStep('pick')
      } else {
        setHoldRemaining(secs)
      }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [booking.holdExpiresAt, step])

  // Single source of truth for releasing a hold: whenever holdId stops
  // pointing at a hold (slot change, expiry, confirm, or unmount), free it.
  useEffect(() => {
    const id = booking.holdId
    return () => { if (id) releaseHold(id) }
  }, [booking.holdId, releaseHold])

  function navigate(to: Step, direction: number) {
    setDir(direction)
    setStep(to)
  }

  function goBack() {
    const prev: Record<Step, Step | null> = {
      service: null, pick: 'service', info: 'pick', done: null,
    }
    const p = prev[step]
    if (p) navigate(p, -1)
  }

  function handleNext() {
    if (step === 'service' && booking.service) navigate('pick', 1)
    else if (step === 'pick' && booking.slot) navigate('info', 1)
    else if (step === 'info') {
      const errors: typeof infoErrors = {}
      if (!booking.name.trim()) errors.name = 'El nombre es requerido'
      if (!booking.phone.trim() || booking.phone.trim().length < 6) errors.phone = 'El teléfono es requerido'
      if (booking.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.email.trim())) errors.email = 'Ingresá un email válido'
      if (Object.keys(errors).length) { setInfoErrors(errors); return }
      setInfoErrors({})
      confirm()
    }
  }

  const canNext =
    (step === 'service' && !!booking.service) ||
    (step === 'pick' && !!booking.slot) ||
    step === 'info'

  const stepIdx = STEPS.indexOf(step)
  const progressPct = step === 'done' ? 100 : (stepIdx / (STEPS.length - 1)) * 100

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)]" style={{ display: 'grid', gridTemplateColumns: '1fr' }}>
      {/* Split layout on desktop */}
      <div className="min-h-[100dvh] grid grid-cols-1 md:grid-cols-[2fr_3fr]">

        {/* Left: dark sidebar */}
        <LeftSidebar step={step} booking={booking} shop={shop} />

        {/* Right: step content */}
        <div className="flex flex-col min-h-[100dvh]">

          {/* Mobile header */}
          <div className="md:hidden flex items-center gap-3 px-5 pt-6 pb-2"
            style={{ borderBottom: '1px solid var(--color-border)' }}>
            <div className="size-7 rounded-xl overflow-hidden shrink-0">
              <img src={shop.logo_url ?? '/favicon.png'} alt={shop.name} className="size-full object-cover" />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-bold text-[var(--color-fg)] tracking-tight block">{shop.name}</span>
              {shop.address && (
                <span className="text-[10px] text-[var(--color-fg-muted)] block truncate">{shop.address}</span>
              )}
            </div>
          </div>

          {/* Step area */}
          <div className="flex-1 flex flex-col px-5 md:px-10 pt-6 md:pt-10 pb-6 overflow-y-auto">

            {/* Header section */}
            {step !== 'done' && (
              <div className="mb-7">
                {/* Back + step label row */}
                <div className="flex items-center gap-3 mb-5">
                  {step !== 'service' && (
                    <Tooltip content="Volver" side="bottom">
                      <button
                        type="button"
                        onClick={goBack}
                        className="size-9 flex items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2"
                        style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                        aria-label="Volver"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                    </Tooltip>
                  )}
                  <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: ACCENT }}
                    role="status"
                    aria-live="polite"
                    aria-label={`Paso ${stepIdx + 1} de ${STEPS.length - 1}`}
                  >
                    {stepIdx + 1} / {STEPS.length - 1}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-0.5 rounded-full bg-[var(--color-bg-subtle)] overflow-hidden mb-5">
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${progressPct}%` }}
                    transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                    style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DARK})` }}
                  />
                </div>

                {/* Title */}
                <motion.div
                  key={`title-${step}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <h1 className="text-2xl font-bold text-[var(--color-fg)] tracking-tight leading-tight">
                    {STEP_META[step].title}
                  </h1>
                  <p className="text-sm text-[var(--color-fg-muted)] mt-1">
                    {STEP_META[step].sub}
                  </p>
                </motion.div>
              </div>
            )}

            {/* Step content */}
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                variants={stepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="flex-1"
              >
                {step === 'service' && (
                  <StepService
                    services={services}
                    selected={booking.service}
                    onSelect={(s) => setBooking((b) => ({
                      ...b,
                      service: s,
                      barber: undefined,
                      slot: undefined,
                      date: undefined,
                      holdId: undefined,
                      holdExpiresAt: undefined,
                    }))}
                  />
                )}
                {step === 'pick' && booking.service && (
                  <StepPick
                    allBarbers={barbers}
                    service={booking.service}
                    selectedDate={booking.date}
                    selectedSlot={booking.slot}
                    isHolding={isHolding}
                    onDateSelect={(d) => setBooking((b) => ({ ...b, date: d, slot: undefined, holdId: undefined, holdExpiresAt: undefined }))}
                    onSlotSelect={(s, assignedBarber) => holdSlot({ slot: s, barber: assignedBarber })}
                  />
                )}
                {step === 'info' && (
                  <StepInfo
                    name={booking.name}
                    phone={booking.phone}
                    email={booking.email}
                    onChangeName={(v) => setBooking((b) => ({ ...b, name: v }))}
                    onChangePhone={(v) => setBooking((b) => ({ ...b, phone: v }))}
                    onChangeEmail={(v) => setBooking((b) => ({ ...b, email: v }))}
                    errors={infoErrors}
                  />
                )}
                {step === 'done' && booking.bookingCode && (
                  <StepDone booking={booking} code={booking.bookingCode} shop={shop} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Sticky CTA */}
          <div className="px-5 md:px-10 pb-8 pt-4 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
            <AnimatePresence>
              {holdRemaining != null && holdRemaining > 0 && (step === 'pick' || step === 'info') && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] py-2 text-xs"
                  role="status"
                  aria-live="polite"
                >
                  <Clock className="size-3.5" style={{ color: ACCENT }} />
                  <span className="text-[var(--color-fg-muted)]">Horario reservado ·</span>
                  <span className="font-semibold tabular-nums font-[var(--font-mono)]" style={{ color: ACCENT }}>
                    {Math.floor(holdRemaining / 60)}:{String(holdRemaining % 60).padStart(2, '0')}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            {step !== 'done' ? (
              <MagneticButton onClick={handleNext} disabled={!canNext} loading={isPending}>
                {step === 'info' ? 'Confirmar turno' : (
                  <span className="flex items-center gap-2">
                    Continuar
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-80">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                )}
              </MagneticButton>
            ) : (
              <button
                type="button"
                onClick={() => { navigate('service', -1); setBooking({ name: '', phone: '', email: '' }) }}
                className="w-full h-14 rounded-2xl border border-[var(--color-border)] text-sm font-semibold text-[var(--color-fg)] bg-[var(--color-bg)] hover:bg-[var(--color-bg-subtle)] transition-colors active:scale-[0.98]"
              >
                Reservar otro turno
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
