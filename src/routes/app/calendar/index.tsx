import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useUIStore } from '@/store/ui.store'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { addDays, subDays, parseISO } from 'date-fns'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  format,
  addMonths,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { keys } from '@/lib/query-keys'
import {
  now,
  startOfDay,
  endOfDay,
  formatTime,
  formatDayHeading,
  isToday,
} from '@/lib/time'
import type { Appointment, Barber, BarberSchedule, TimeOff } from '@/types/database'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { NamedAvatar } from '@/components/ui/avatar'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { AppointmentDetailSheet } from '@/components/appointments/AppointmentDetailSheet'

// ── View type ─────────────────────────────────────────────────────────────────

type CalendarView = 'day' | 'week' | 'month'

// ── Constants ─────────────────────────────────────────────────────────────────

const START_HOUR = 8   // 8am
const END_HOUR   = 21  // 9pm
const HOUR_PX    = 64  // pixels per hour
const MIN_PX     = HOUR_PX / 60

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function appointmentTop(startTime: string): number {
  const d = parseISO(startTime)
  return (minutesFromMidnight(d) - START_HOUR * 60) * MIN_PX
}

function appointmentHeight(startTime: string, endTime: string): number {
  const start = parseISO(startTime)
  const end   = parseISO(endTime)
  const minutes = (end.getTime() - start.getTime()) / 60_000
  return Math.max(minutes * MIN_PX, 28)
}

/** Parse a "HH:mm:ss" or "HH:mm" time string into minutes from midnight */
function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

/** Convert minutes-from-midnight to pixel offset within the calendar grid */
function minutesToPx(minutes: number): number {
  return (minutes - START_HOUR * 60) * MIN_PX
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function fetchBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase
    .from('barbers')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Barber[]
}

async function fetchAppointmentsForDay(date: Date): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`*, client:clients(*), barber:barbers(*), service:services(*)`)
    .gte('start_time', startOfDay(date).toISOString())
    .lte('start_time', endOfDay(date).toISOString())
    .not('status', 'in', '(cancelled,no_show)')
    .order('start_time', { ascending: true })
  if (error) throw error
  return (data ?? []) as Appointment[]
}

async function fetchAppointmentsForRange(from: Date, to: Date): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(`*, client:clients(*), barber:barbers(*), service:services(*)`)
    .gte('start_time', startOfDay(from).toISOString())
    .lte('start_time', endOfDay(to).toISOString())
    .not('status', 'in', '(cancelled,no_show)')
    .order('start_time', { ascending: true })
  if (error) throw error
  return (data ?? []) as Appointment[]
}

async function fetchTimeOffForRange(from: Date, to: Date): Promise<TimeOff[]> {
  const { data, error } = await supabase
    .from('time_off')
    .select('*')
    .lt('start_at', endOfDay(to).toISOString())
    .gt('end_at', startOfDay(from).toISOString())
  if (error) throw error
  return (data ?? []) as TimeOff[]
}

async function fetchSchedulesForDay(dayOfWeek: number): Promise<BarberSchedule[]> {
  const { data, error } = await supabase
    .from('barber_schedules')
    .select('*')
    .eq('day_of_week', dayOfWeek)
  if (error) throw error
  return (data ?? []) as BarberSchedule[]
}

// ── Now-line ──────────────────────────────────────────────────────────────────

function NowLine() {
  const n = now()
  const topPx = (minutesFromMidnight(n) - START_HOUR * 60) * MIN_PX
  if (topPx < 0 || topPx > (END_HOUR - START_HOUR) * HOUR_PX) return null
  return (
    <div
      className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
      style={{ top: topPx }}
    >
      <div className="size-2 rounded-full bg-[var(--color-primary)] shrink-0 -ml-1" />
      <div className="flex-1 h-px bg-[var(--color-primary)]" />
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function CalendarSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex h-full gap-2 p-3" aria-hidden="true">
      {Array.from({ length: columns }).map((_, col) => (
        <div key={col} className="flex-1 space-y-2">
          <div className="h-6 rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] animate-pulse" />
          {Array.from({ length: 5 }).map((_, row) => (
            <div
              key={row}
              className="rounded-[var(--radius-md)] bg-[var(--color-bg-subtle)] animate-pulse"
              style={{ height: 40 + ((col + row) % 3) * 28, opacity: 1 - row * 0.12 }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── End-of-day line ───────────────────────────────────────────────────────────

function EndOfDayLine({
  endTimeStr,
  totalHeight,
}: {
  endTimeStr: string
  totalHeight: number
}) {
  const { t } = useTranslation('calendar')
  const endMinutes = timeStringToMinutes(endTimeStr)
  const topPx = minutesToPx(endMinutes)

  // Don't render if outside the visible calendar range
  if (topPx < 0 || topPx > totalHeight) return null

  const overlayHeight = totalHeight - topPx

  return (
    <>
      {/* Red overlay from end_time to bottom */}
      <div
        className="absolute left-0 right-0 pointer-events-none z-10"
        style={{
          top: topPx,
          height: overlayHeight,
          backgroundColor: 'rgba(239, 68, 68, 0.06)',
        }}
      />

      {/* The red line itself */}
      <div
        className="absolute left-0 right-0 z-20 pointer-events-none"
        style={{ top: topPx }}
      >
        <div className="relative">
          <div
            className="h-[2px] w-full"
            style={{ backgroundColor: '#ef4444' }}
          />
          <span
            className="absolute right-1.5 -top-4 text-[9px] font-semibold whitespace-nowrap"
            style={{ color: '#ef4444' }}
          >
            {t('end_of_shift')}
          </span>
        </div>
      </div>
    </>
  )
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface ContextMenuState {
  appt: Appointment
  x: number
  y: number
}

interface ContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onEdit: (appt: Appointment) => void
  onDuplicate: (appt: Appointment) => void
  onCancel: (appt: Appointment) => void
  isCancelling: boolean
}

function AppointmentContextMenu({
  state,
  onClose,
  onEdit,
  onDuplicate,
  onCancel,
  isCancelling,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Clamp position to viewport
  const MENU_W = 188
  const MENU_H = 130
  const x = Math.min(state.x, window.innerWidth  - MENU_W - 8)
  const y = Math.min(state.y, window.innerHeight - MENU_H - 8)

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const itemClass =
    'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left rounded-lg transition-colors duration-100 hover:bg-[var(--color-bg-subtle)] text-[var(--color-fg)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className="fixed z-[9999] rounded-xl shadow-xl p-1.5 min-w-[188px]"
      style={{
        left: x,
        top: y,
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
      }}
    >
      {/* Appointment label */}
      <div className="px-3 py-1.5 mb-0.5">
        <p className="text-[11px] font-semibold text-[var(--color-fg-muted)] truncate max-w-[160px]">
          {state.appt.client?.name ?? 'Appointment'}
        </p>
      </div>

      <div className="h-px bg-[var(--color-border)] mb-1" />

      {/* Duplicate */}
      <button
        className={itemClass}
        onClick={() => { onDuplicate(state.appt); onClose() }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M3 11V3a1 1 0 0 1 1-1h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        Duplicar turno
      </button>

      {/* Edit */}
      <button
        className={itemClass}
        onClick={() => { onEdit(state.appt); onClose() }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M11.5 2.5a1.415 1.415 0 0 1 2 2L5 13H2v-3L11.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
        Editar / Ver detalles
      </button>

      <div className="h-px bg-[var(--color-border)] my-1" />

      {/* Cancel */}
      {confirmCancel ? (
        <div className="px-3 py-2">
          <p className="text-[12px] text-[var(--color-fg-muted)] mb-2">¿Cancelar este turno?</p>
          <div className="flex gap-1.5">
            <button
              className="flex-1 px-2 py-1 text-[12px] rounded-md border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] transition-colors"
              onClick={() => setConfirmCancel(false)}
            >
              No
            </button>
            <button
              className="flex-1 px-2 py-1 text-[12px] rounded-md font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#ef4444' }}
              disabled={isCancelling}
              onClick={() => onCancel(state.appt)}
            >
              {isCancelling ? '...' : 'Sí'}
            </button>
          </div>
        </div>
      ) : (
        <button
          className={cn(itemClass, 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20')}
          onClick={() => setConfirmCancel(true)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 5.5 5.5 10.5M5.5 5.5l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Cancelar turno
        </button>
      )}
    </motion.div>
  )
}

// ── Appointment block ─────────────────────────────────────────────────────────

function AppointmentBlock({
  appt,
  onClick,
  onContextMenu,
}: {
  appt: Appointment
  onClick: () => void
  onContextMenu: (e: React.MouseEvent, appt: Appointment) => void
}) {
  const top    = appointmentTop(appt.start_time)
  const height = appointmentHeight(appt.start_time, appt.end_time)
  const color  = appt.barber?.color ?? '#6366f1'

  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: appt.id,
    data: { appt },
  })

  const style: React.CSSProperties = {
    top,
    height,
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.35 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <motion.div
      ref={setNodeRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: isDragging ? 0.35 : 1, scale: 1 }}
      transition={{ duration: 0.15 }}
      onClick={onClick}
      onContextMenu={(e) => onContextMenu(e, appt)}
      className="absolute left-1 right-1 rounded-[var(--radius-md)] overflow-hidden group"
      style={style}
      {...attributes}
      {...listeners}
    >
      <div
        className="h-full px-2 py-1.5 flex flex-col gap-0.5 text-white"
        style={{ backgroundColor: color + 'dd', borderLeft: `3px solid ${color}` }}
      >
        <p className="text-[11px] font-semibold leading-tight truncate">
          {appt.client?.name ?? 'Client'}
        </p>
        {height > 36 && (
          <p className="text-[10px] opacity-80 leading-tight truncate">
            {appt.service?.name}
          </p>
        )}
        {height > 52 && (
          <p className="text-[10px] opacity-70 leading-none tabular-nums">
            {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ── Drag Overlay Card ─────────────────────────────────────────────────────────

function DragOverlayCard({ appt }: { appt: Appointment }) {
  const height = appointmentHeight(appt.start_time, appt.end_time)
  const color  = appt.barber?.color ?? '#6366f1'

  return (
    <div
      className="rounded-[var(--radius-md)] overflow-hidden"
      style={{
        width: '100%',
        height,
        transform: 'scale(1.03)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        cursor: 'grabbing',
        opacity: 1,
      }}
    >
      <div
        className="h-full px-2 py-1.5 flex flex-col gap-0.5 text-white"
        style={{ backgroundColor: color + 'dd', borderLeft: `3px solid ${color}` }}
      >
        <p className="text-[11px] font-semibold leading-tight truncate">
          {appt.client?.name ?? 'Client'}
        </p>
        {height > 36 && (
          <p className="text-[10px] opacity-80 leading-tight truncate">
            {appt.service?.name}
          </p>
        )}
        {height > 52 && (
          <p className="text-[10px] opacity-70 leading-none tabular-nums">
            {formatTime(appt.start_time)} – {formatTime(appt.end_time)}
          </p>
        )}
      </div>
    </div>
  )
}

// ── Droppable Barber Column ───────────────────────────────────────────────────

function DroppableBarberColumn({
  barber,
  colIdx,
  totalHeight,
  endTimeStr,
  children,
}: {
  barber: Barber
  colIdx: number
  totalHeight: number
  endTimeStr: string | null
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({
    id: barber.id,
    data: { barberId: barber.id },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 relative border-l border-[var(--color-border)] min-w-0',
        colIdx === 0 && 'border-l'
      )}
      style={{ height: totalHeight }}
    >
      {children}
      {endTimeStr && (
        <EndOfDayLine endTimeStr={endTimeStr} totalHeight={totalHeight} />
      )}
    </div>
  )
}

// ── View Toggle ───────────────────────────────────────────────────────────────

const VIEW_OPTIONS: { value: CalendarView; labelKey: string }[] = [
  { value: 'day',   labelKey: 'view_day' },
  { value: 'week',  labelKey: 'view_week' },
  { value: 'month', labelKey: 'view_month' },
]

function ViewToggle({
  view,
  onChange,
}: {
  view: CalendarView
  onChange: (v: CalendarView) => void
}) {
  const { t } = useTranslation('calendar')
  return (
    <div
      className="flex items-center rounded-full p-0.5 gap-0.5"
      style={{
        backgroundColor: 'var(--color-bg-muted)',
        border: '1px solid var(--color-border)',
      }}
    >
      {VIEW_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium transition-all duration-150',
            view === opt.value
              ? 'text-white shadow-sm'
              : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
          )}
          style={
            view === opt.value
              ? { backgroundColor: 'var(--color-primary)' }
              : {}
          }
        >
          {t(opt.labelKey as 'view_day' | 'view_week' | 'view_month')}
        </button>
      ))}
    </div>
  )
}

// ── Month View ────────────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface MonthViewProps {
  monthDate: Date
  appointments: Appointment[]
  timeOffs: TimeOff[]
  barbers: Barber[]
  onDayClick: (day: Date) => void
}

function MonthView({
  monthDate,
  appointments,
  timeOffs,
  barbers,
  onDayClick,
}: MonthViewProps) {
  const monthStart = startOfMonth(monthDate)
  const monthEnd   = endOfMonth(monthDate)

  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd   = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const apptByDay = new Map<string, Appointment[]>()
  for (const appt of appointments) {
    const key = format(parseISO(appt.start_time), 'yyyy-MM-dd')
    const existing = apptByDay.get(key) ?? []
    apptByDay.set(key, [...existing, appt])
  }

  const barberMap = new Map<string, Barber>(barbers.map((b) => [b.id, b]))

  return (
    <div className="flex flex-col h-full">
      {/* Weekday header */}
      <div
        className="grid grid-cols-7 shrink-0 border-b border-[var(--color-border)]"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-[11px] font-semibold text-[var(--color-fg-muted)] uppercase tracking-wide"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        className="grid grid-cols-7 flex-1 overflow-y-auto"
        style={{ gridAutoRows: 'minmax(100px, 1fr)' }}
      >
        {days.map((day) => {
          const key       = format(day, 'yyyy-MM-dd')
          const dayAppts  = apptByDay.get(key) ?? []
          const inMonth   = isSameMonth(day, monthDate)
          const todayDay  = isToday(day)

          const dayTimeOffs = timeOffs.filter((to) => {
            const toStart = parseISO(to.start_at)
            const toEnd   = parseISO(to.end_at)
            return toStart <= endOfDay(day) && toEnd >= startOfDay(day)
          })

          const visibleAppts  = dayAppts.slice(0, 3)
          const overflowCount = dayAppts.length - 3

          return (
            <button
              key={key}
              onClick={() => onDayClick(day)}
              className={cn(
                'relative flex flex-col text-left border-b border-r border-[var(--color-border)] p-1.5 transition-colors duration-100 min-h-[100px]',
                'hover:bg-[var(--color-bg-subtle)]',
                !inMonth && 'opacity-40'
              )}
              style={{ backgroundColor: 'var(--color-bg)' }}
            >
              {/* Vacation stripes */}
              {dayTimeOffs.map((to) => {
                const barber  = barberMap.get(to.barber_id)
                const color   = barber?.color ?? 'var(--color-primary)'
                const initial = barber?.name?.[0]?.toUpperCase() ?? '?'
                return (
                  <div
                    key={to.id}
                    className="w-full rounded-sm mb-0.5 px-1 flex items-center gap-0.5 overflow-hidden"
                    style={{
                      backgroundColor: color + '33',
                      borderLeft: `2px solid ${color}`,
                      height: 14,
                    }}
                  >
                    <span
                      className="text-[9px] font-bold leading-none shrink-0"
                      style={{ color }}
                    >
                      {initial}
                    </span>
                    <span
                      className="text-[9px] leading-none truncate"
                      style={{ color }}
                    >
                      vacation
                    </span>
                  </div>
                )
              })}

              {/* Date number */}
              <div className="flex justify-end mb-1">
                <span
                  className={cn(
                    'text-[12px] font-semibold leading-none w-6 h-6 flex items-center justify-center rounded-full',
                    todayDay ? 'text-white' : 'text-[var(--color-fg)]'
                  )}
                  style={todayDay ? { backgroundColor: 'var(--color-primary)' } : {}}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Appointment pills */}
              <div className="flex flex-col gap-0.5 flex-1 min-h-0">
                {visibleAppts.map((appt) => {
                  const color = appt.barber?.color ?? '#6366f1'
                  return (
                    <div
                      key={appt.id}
                      className="w-full rounded px-1 flex items-center overflow-hidden"
                      style={{
                        backgroundColor: color + '22',
                        borderLeft: `2px solid ${color}`,
                        height: 16,
                      }}
                    >
                      <span
                        className="text-[10px] font-medium leading-none truncate"
                        style={{ color }}
                      >
                        {appt.client?.name ?? 'Client'}
                      </span>
                    </div>
                  )
                })}

                {overflowCount > 0 && (
                  <div className="px-1">
                    <span className="text-[10px] text-[var(--color-fg-muted)] font-medium">
                      +{overflowCount} more
                    </span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Week View ─────────────────────────────────────────────────────────────────

const SHORT_DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface WeekViewProps {
  weekStart: Date
  appointments: Appointment[]
  timeOffs: TimeOff[]
  barbers: Barber[]
  onDayClick: (day: Date) => void
}

function WeekView({
  weekStart,
  appointments,
  timeOffs,
  barbers,
  onDayClick,
}: WeekViewProps) {
  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })

  const barberMap = new Map<string, Barber>(barbers.map((b) => [b.id, b]))

  const apptByDay = new Map<string, Appointment[]>()
  for (const appt of appointments) {
    const key = format(parseISO(appt.start_time), 'yyyy-MM-dd')
    const existing = apptByDay.get(key) ?? []
    apptByDay.set(key, [...existing, appt])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Day header row */}
      <div
        className="grid grid-cols-7 shrink-0 border-b border-[var(--color-border)]"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        {days.map((day, i) => {
          const todayDay = isToday(day)
          const dayName = SHORT_DAY_NAMES[i]
          return (
            <div
              key={day.toISOString()}
              className="py-2 text-center"
            >
              <span
                className={cn(
                  'inline-flex flex-col items-center gap-0.5',
                )}
              >
                <span className="text-[10px] font-semibold text-[var(--color-fg-muted)] uppercase tracking-wide">
                  {dayName}
                </span>
                <span
                  className={cn(
                    'text-[13px] font-semibold w-7 h-7 flex items-center justify-center rounded-full',
                    todayDay ? 'text-white' : 'text-[var(--color-fg)]'
                  )}
                  style={todayDay ? { backgroundColor: 'var(--color-primary)' } : {}}
                >
                  {format(day, 'd')}
                </span>
              </span>
            </div>
          )
        })}
      </div>

      {/* Day cells grid — single row */}
      <div
        className="grid grid-cols-7 flex-1 overflow-y-auto"
        style={{ gridAutoRows: 'minmax(120px, 1fr)' }}
      >
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayAppts = apptByDay.get(key) ?? []
          const todayDay = isToday(day)

          const dayTimeOffs = timeOffs.filter((to) => {
            const toStart = parseISO(to.start_at)
            const toEnd   = parseISO(to.end_at)
            return toStart <= endOfDay(day) && toEnd >= startOfDay(day)
          })

          const visibleAppts  = dayAppts.slice(0, 4)
          const overflowCount = dayAppts.length - 4

          return (
            <button
              key={key}
              onClick={() => onDayClick(day)}
              className={cn(
                'relative flex flex-col text-left border-b border-r border-[var(--color-border)] p-1.5 transition-colors duration-100',
                'hover:bg-[var(--color-bg-subtle)]',
                todayDay && 'border-t-2 border-t-[var(--color-primary)]'
              )}
              style={{ backgroundColor: 'var(--color-bg)' }}
            >
              {/* Vacation stripes */}
              {dayTimeOffs.map((to) => {
                const barber  = barberMap.get(to.barber_id)
                const color   = barber?.color ?? 'var(--color-primary)'
                const initial = barber?.name?.[0]?.toUpperCase() ?? '?'
                return (
                  <div
                    key={to.id}
                    className="w-full rounded-sm mb-0.5 px-1 flex items-center gap-0.5 overflow-hidden shrink-0"
                    style={{
                      backgroundColor: color + '33',
                      borderLeft: `2px solid ${color}`,
                      height: 14,
                    }}
                  >
                    <span className="text-[9px] font-bold leading-none shrink-0" style={{ color }}>
                      {initial}
                    </span>
                    <span className="text-[9px] leading-none truncate" style={{ color }}>
                      vacation
                    </span>
                  </div>
                )
              })}

              {/* Appointment pills */}
              <div className="flex flex-col gap-0.5 flex-1 min-h-0 mt-0.5">
                {visibleAppts.map((appt) => {
                  const color = appt.barber?.color ?? '#6366f1'
                  return (
                    <div
                      key={appt.id}
                      className="w-full rounded px-1 flex flex-col overflow-hidden shrink-0"
                      style={{
                        backgroundColor: color + '22',
                        borderLeft: `2px solid ${color}`,
                        minHeight: 20,
                        paddingTop: 2,
                        paddingBottom: 2,
                      }}
                    >
                      <span
                        className="text-[10px] font-medium leading-tight truncate"
                        style={{ color }}
                      >
                        {appt.client?.name ?? 'Client'}
                      </span>
                      <span
                        className="text-[9px] leading-tight opacity-70 tabular-nums"
                        style={{ color }}
                      >
                        {formatTime(appt.start_time)}
                      </span>
                    </div>
                  )
                })}

                {overflowCount > 0 && (
                  <div className="px-1 mt-auto">
                    <span className="text-[10px] text-[var(--color-fg-muted)] font-medium">
                      +{overflowCount} more
                    </span>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { t } = useTranslation(['calendar', 'common'])
  const { calendarView, setCalendarView } = useUIStore()
  const view = calendarView
  const setView = setCalendarView
  const [date, setDate] = useState<Date>(startOfDay(now()))
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null)
  const [activeAppt, setActiveAppt] = useState<Appointment | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('calendar-appointments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' },
        () => qc.invalidateQueries({ queryKey: keys.appointments.all })
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc])

  const { data: barbers = [] } = useQuery({
    queryKey: keys.barbers.list(),
    queryFn: fetchBarbers,
  })

  // ── Month-range helpers ──────────────────────────────────────────────────────
  const monthStart = startOfMonth(date)
  const monthEnd   = endOfMonth(date)

  // Week-range helpers
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const weekEnd   = addDays(weekStart, 6)

  // Day view: single day
  const { data: dayAppointments = [], isLoading: isDayLoading } = useQuery({
    queryKey: keys.appointments.list({ from: date.toISOString() }),
    queryFn: () => fetchAppointmentsForDay(date),
    refetchInterval: 60_000,
    enabled: view === 'day',
  })

  // Week view: full week range
  const { data: weekAppointments = [], isLoading: isWeekLoading } = useQuery({
    queryKey: keys.appointments.list({ from: weekStart.toISOString(), to: weekEnd.toISOString() }),
    queryFn: () => fetchAppointmentsForRange(weekStart, weekEnd),
    refetchInterval: 60_000,
    enabled: view === 'week',
  })

  // Week view: time_off blocks
  const { data: weekTimeOffs = [] } = useQuery({
    queryKey: [...keys.timeOff.all, 'week', format(weekStart, 'yyyy-MM-dd')],
    queryFn: () => fetchTimeOffForRange(weekStart, weekEnd),
    enabled: view === 'week',
  })

  // Month view: whole month
  const { data: monthAppointments = [], isLoading: isMonthLoading } = useQuery({
    queryKey: keys.appointments.list({ from: monthStart.toISOString(), to: monthEnd.toISOString() }),
    queryFn: () => fetchAppointmentsForRange(monthStart, monthEnd),
    refetchInterval: 60_000,
    enabled: view === 'month',
  })

  // Month view: time_off blocks
  const { data: monthTimeOffs = [] } = useQuery({
    queryKey: [...keys.timeOff.all, 'month', format(monthStart, 'yyyy-MM')],
    queryFn: () => fetchTimeOffForRange(monthStart, monthEnd),
    enabled: view === 'month',
  })

  const isLoading = view === 'month' ? isMonthLoading : view === 'week' ? isWeekLoading : isDayLoading

  // Day of week: 0=Sun … 6=Sat (matches barber_schedules.day_of_week)
  const dayOfWeek = date.getDay()

  const { data: schedules = [] } = useQuery({
    queryKey: keys.schedules.byBarber(`day-${dayOfWeek}`),
    queryFn: () => fetchSchedulesForDay(dayOfWeek),
    enabled: view === 'day' || view === 'week',
  })

  /** Lookup map: barberId → end_time string */
  const scheduleByBarber = Object.fromEntries(
    schedules.map((s) => [s.barber_id, s.end_time])
  )

  // ── Reschedule mutation ──────────────────────────────────────────────────────

  const { mutate: reschedule } = useMutation({
    mutationFn: async ({
      appt,
      newStart,
      newEnd,
      newBarberId,
    }: {
      appt: Appointment
      newStart: Date
      newEnd: Date
      newBarberId: string
    }) => {
      const { error } = await supabase
        .from('appointments')
        .update({
          start_time: newStart.toISOString(),
          end_time:   newEnd.toISOString(),
          barber_id:  newBarberId,
        })
        .eq('id', appt.id)
      if (error) throw error
    },
    onMutate: async ({ appt, newStart, newEnd, newBarberId }) => {
      await qc.cancelQueries({ queryKey: keys.appointments.all })
      const snapshot = qc.getQueryData(
        keys.appointments.list({ from: date.toISOString() })
      )
      qc.setQueryData(
        keys.appointments.list({ from: date.toISOString() }),
        (old: Appointment[] | undefined) =>
          (old ?? []).map((a) =>
            a.id === appt.id
              ? {
                  ...a,
                  start_time: newStart.toISOString(),
                  end_time:   newEnd.toISOString(),
                  barber_id:  newBarberId,
                }
              : a
          )
      )
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) {
        qc.setQueryData(
          keys.appointments.list({ from: date.toISOString() }),
          ctx.snapshot
        )
      }
      toast.error('No se pudo reprogramar — se restauró el horario original.')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.appointments.all })
      toast.success('Turno reprogramado')
    },
  })

  // ── Cancel mutation ──────────────────────────────────────────────────────────

  const { mutate: cancelAppt, isPending: isCancelling } = useMutation({
    mutationFn: async (appt: Appointment) => {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', appt.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.appointments.all })
      toast.success('Turno cancelado')
      setContextMenu(null)
    },
    onError: () => toast.error('No se pudo cancelar el turno'),
  })

  // ── Duplicate mutation ───────────────────────────────────────────────────────

  const { mutate: duplicateAppt } = useMutation({
    mutationFn: async (appt: Appointment) => {
      const origStart = parseISO(appt.start_time)
      const origEnd   = parseISO(appt.end_time)
      const tomorrowStart = addDays(origStart, 1)
      const tomorrowEnd   = addDays(origEnd, 1)

      const { error } = await supabase
        .from('appointments')
        .insert({
          client_id:     appt.client_id,
          barber_id:     appt.barber_id,
          service_id:    appt.service_id,
          start_time:    tomorrowStart.toISOString(),
          end_time:      tomorrowEnd.toISOString(),
          status:        'confirmed',
          price_charged: appt.price_charged,
          notes:         appt.notes,
        })
      if (error) throw error
    },
    onSuccess: (_data, appt) => {
      qc.invalidateQueries({ queryKey: keys.appointments.all })
      const origStart = parseISO(appt.start_time)
      const tomorrowDate = addDays(origStart, 1)
      const dayName = tomorrowDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })
      toast.success(`Turno duplicado para ${dayName}`)
    },
    onError: () => toast.error('No se pudo duplicar el turno'),
  })

  // ── Context menu handlers ────────────────────────────────────────────────────

  const handleContextMenu = useCallback((e: React.MouseEvent, appt: Appointment) => {
    e.preventDefault()
    setContextMenu({ appt, x: e.clientX, y: e.clientY })
  }, [])

  const handleContextClose = useCallback(() => setContextMenu(null), [])

  // ── DnD sensors ─────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  )

  function handleDragStart(event: DragStartEvent) {
    const appt = event.active.data.current?.appt as Appointment | undefined
    setActiveAppt(appt ?? null)
    // Close context menu on drag start
    setContextMenu(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveAppt(null)

    const { active, over, delta } = event
    if (!over) return

    const appt = active.data.current?.appt as Appointment
    const targetBarberId = over.data.current?.barberId as string

    // Snap to 15-minute grid
    const deltaMinutes = Math.round(delta.y / MIN_PX / 15) * 15
    const originalStart = parseISO(appt.start_time)
    const originalEnd   = parseISO(appt.end_time)
    const durationMs    = originalEnd.getTime() - originalStart.getTime()

    const newStart = new Date(originalStart.getTime() + deltaMinutes * 60_000)
    const newEnd   = new Date(newStart.getTime() + durationMs)

    // Clamp within working hours
    const dayStart = new Date(newStart)
    dayStart.setHours(START_HOUR, 0, 0, 0)
    const dayEnd = new Date(newStart)
    dayEnd.setHours(END_HOUR, 0, 0, 0)
    if (newStart < dayStart || newEnd > dayEnd) return

    // Reject drop into blocked (after end-of-day) zone for target barber
    const targetEndTime = scheduleByBarber[targetBarberId]
    if (targetEndTime) {
      const endMinutes = timeStringToMinutes(targetEndTime)
      const newStartMinutes = newStart.getHours() * 60 + newStart.getMinutes()
      if (newStartMinutes >= endMinutes) {
        toast.error('El barbero ya terminó su jornada a esa hora.')
        return
      }
    }

    // No change
    if (
      newStart.getTime() === originalStart.getTime() &&
      targetBarberId === appt.barber_id
    ) return

    reschedule({ appt, newStart, newEnd, newBarberId: targetBarberId })
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  function handlePrev() {
    if (view === 'month') {
      setDate((d) => startOfDay(subMonths(d, 1)))
    } else if (view === 'week') {
      setDate((d) => startOfDay(subDays(d, 7)))
    } else {
      setDate((d) => startOfDay(subDays(d, 1)))
    }
  }

  function handleNext() {
    if (view === 'month') {
      setDate((d) => startOfDay(addMonths(d, 1)))
    } else if (view === 'week') {
      setDate((d) => startOfDay(addDays(d, 7)))
    } else {
      setDate((d) => startOfDay(addDays(d, 1)))
    }
  }

  function handleMonthDayClick(day: Date) {
    setDate(startOfDay(day))
    setView('week')
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const totalHeight = (END_HOUR - START_HOUR) * HOUR_PX

  // In day view, dayAppointments is already scoped to the selected day
  const appointmentsByBarber = (barberId: string) =>
    dayAppointments.filter((a) => a.barber_id === barberId)

  const dayLabel = view === 'month'
    ? format(date, 'MMMM yyyy')
    : view === 'week'
    ? `${format(weekStart, 'd')}–${format(weekEnd, 'd')} ${format(weekEnd, 'MMM yyyy', { locale: es })}`
    : formatDayHeading(date)

  return (
    <PageShell
      title={t('calendar:title')}
      noPadding
      headerActions={
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <ViewToggle view={view} onChange={setView} />

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDate(startOfDay(now()))}
              disabled={
                view === 'month'
                  ? isSameMonth(date, now())
                  : view === 'week'
                  ? isSameDay(weekStart, startOfWeek(now(), { weekStartsOn: 1 }))
                  : isToday(date)
              }
            >
              {t('common:today')}
            </Button>
            <div className="flex items-center">
              <Tooltip content={view === 'month' ? 'Mes anterior' : view === 'week' ? 'Semana anterior' : 'Día anterior'}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handlePrev}
                  aria-label={view === 'month' ? 'Previous month' : 'Previous day'}
                >
                  <ChevronLeft className="size-4" />
                </Button>
              </Tooltip>
              <span className="px-2 text-sm font-medium text-[var(--color-fg)] min-w-[160px] text-center">
                {dayLabel}
              </span>
              <Tooltip content={view === 'month' ? 'Mes siguiente' : view === 'week' ? 'Semana siguiente' : 'Día siguiente'}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleNext}
                  aria-label={view === 'month' ? 'Next month' : 'Next day'}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </Tooltip>
            </div>
          </div>
        </div>
      }
    >
      {barbers.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center space-y-2">
            <CalendarDays className="size-10 mx-auto text-[var(--color-fg-muted)]" />
            <p className="text-sm font-medium text-[var(--color-fg)]">{t('calendar:no_barbers')}</p>
            <p className="text-xs text-[var(--color-fg-muted)]">{t('calendar:no_barbers_hint')}</p>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {view === 'month' ? (
              <motion.div
                key="month"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 overflow-hidden"
              >
                {isLoading ? (
                  <CalendarSkeleton columns={7} />
                ) : (
                  <MonthView
                    monthDate={date}
                    appointments={monthAppointments}
                    timeOffs={monthTimeOffs}
                    barbers={barbers}
                    onDayClick={handleMonthDayClick}
                  />
                )}
              </motion.div>
            ) : view === 'week' ? (
              <motion.div
                key="week"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 overflow-hidden"
              >
                {isLoading ? (
                  <CalendarSkeleton columns={7} />
                ) : (
                  <WeekView
                    weekStart={weekStart}
                    appointments={weekAppointments}
                    timeOffs={weekTimeOffs}
                    barbers={barbers}
                    onDayClick={(day) => { setDate(startOfDay(day)); setView('day') }}
                  />
                )}
              </motion.div>
            ) : (
              <motion.div
                key="day"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-1 flex-col overflow-hidden"
              >
                {/* Header row — barber columns */}
                <div className="flex shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                  {/* Time gutter */}
                  <div className="w-14 shrink-0" />
                  {barbers.map((barber) => (
                    <div
                      key={barber.id}
                      className="flex-1 flex items-center gap-2 px-3 py-2.5 border-l border-[var(--color-border)] min-w-0"
                    >
                      <NamedAvatar name={barber.name} color={barber.color} size="sm" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--color-fg)] truncate">{barber.name}</p>
                        <p className="text-[10px] text-[var(--color-fg-muted)]">
                          {t(
                            appointmentsByBarber(barber.id).length === 1
                              ? 'calendar:appt_count_one'
                              : 'calendar:appt_count_other',
                            { count: appointmentsByBarber(barber.id).length }
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scrollable grid */}
                <div className="flex-1 overflow-y-auto" data-tour="calendar-grid">
                  <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex" style={{ height: totalHeight + 32 }}>
                      {/* Time gutter */}
                      <div className="w-14 shrink-0 relative">
                        {hours.map((hour) => (
                          <div
                            key={hour}
                            className="absolute left-0 right-0 flex items-center justify-end pr-2"
                            style={{ top: (hour - START_HOUR) * HOUR_PX - 8 }}
                          >
                            <span className="text-[10px] font-medium text-[var(--color-fg-muted)] tabular-nums">
                              {hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Barber columns */}
                      {barbers.map((barber, colIdx) => (
                        <DroppableBarberColumn
                          key={barber.id}
                          barber={barber}
                          colIdx={colIdx}
                          totalHeight={totalHeight}
                          endTimeStr={scheduleByBarber[barber.id] ?? null}
                        >
                          {/* Hour grid lines */}
                          {hours.map((hour) => (
                            <div
                              key={hour}
                              className="absolute left-0 right-0 border-t border-[var(--color-border)] pointer-events-none"
                              style={{ top: (hour - START_HOUR) * HOUR_PX }}
                            >
                              {/* Half-hour line */}
                              <div
                                className="absolute left-0 right-0 border-t border-dashed border-[var(--color-border)] opacity-50 pointer-events-none"
                                style={{ top: HOUR_PX / 2 }}
                              />
                            </div>
                          ))}

                          {/* Now line (only on today) */}
                          {isToday(date) && <NowLine />}

                          {/* Appointments */}
                          {isLoading
                            ? null
                            : appointmentsByBarber(barber.id).map((appt) => (
                                <AppointmentBlock
                                  key={appt.id}
                                  appt={appt}
                                  onClick={() => setSelectedAppt(appt)}
                                  onContextMenu={handleContextMenu}
                                />
                              ))}
                        </DroppableBarberColumn>
                      ))}
                    </div>

                    {/* Drag overlay */}
                    <DragOverlay dropAnimation={null}>
                      {activeAppt ? <DragOverlayCard appt={activeAppt} /> : null}
                    </DragOverlay>
                  </DndContext>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Right-click context menu */}
      <AnimatePresence>
        {contextMenu && (
          <AppointmentContextMenu
            state={contextMenu}
            onClose={handleContextClose}
            onEdit={(appt) => setSelectedAppt(appt)}
            onDuplicate={(appt) => duplicateAppt(appt)}
            onCancel={(appt) => cancelAppt(appt)}
            isCancelling={isCancelling}
          />
        )}
      </AnimatePresence>

      <AppointmentDetailSheet
        appointment={selectedAppt}
        open={!!selectedAppt}
        onOpenChange={(v) => { if (!v) setSelectedAppt(null) }}
      />
    </PageShell>
  )
}
