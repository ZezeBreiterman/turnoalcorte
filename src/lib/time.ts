/**
 * ALL date/time logic lives here.
 * No raw `new Date()` calls anywhere else in the codebase.
 * This is the single place to audit for timezone correctness.
 */
import {
  format,
  formatDistanceToNow,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
  startOfDay,
  endOfDay,
  addMinutes,
  addDays,
  differenceInMinutes,
  isWithinInterval,
  isBefore,
  isAfter,
  set,
  getDay,
} from 'date-fns'
import { es, enUS, type Locale } from 'date-fns/locale'
import i18n from '@/i18n'

// ─── Locale resolver ──────────────────────────────────────────────────────────

function currentLocale(): Locale {
  const lang = i18n.language || 'es'
  return lang.startsWith('en') ? enUS : es
}

// ─── Primitives ───────────────────────────────────────────────────────────────

export const now = () => new Date()
export const today = () => startOfDay(new Date())
export const todayEnd = () => endOfDay(new Date())

export const parseTimestamp = (ts: string): Date => parseISO(ts)
export const parseDate = (ts: string): Date => startOfDay(parseISO(ts))

// ─── Formatters ───────────────────────────────────────────────────────────────

export const formatTime = (date: Date | string): string =>
  format(typeof date === 'string' ? parseISO(date) : date, 'h:mm a')

export const formatDate = (date: Date | string): string =>
  format(typeof date === 'string' ? parseISO(date) : date, 'dd/MM/yyyy')

export const formatDateShort = (date: Date | string): string =>
  format(typeof date === 'string' ? parseISO(date) : date, 'dd/MM')

export const formatDayHeading = (date: Date | string): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'EEEE, MMMM d')
}

export const formatTimeRange = (start: Date | string, end: Date | string): string =>
  `${formatTime(start)} – ${formatTime(end)}`

export const formatRelative = (date: Date | string): string =>
  formatDistanceToNow(typeof date === 'string' ? parseISO(date) : date, {
    addSuffix: true,
  })

export interface FormatPriceOptions {
  currency?: string
  locale?: string
}

export const formatPrice = (
  value: number | string,
  options?: FormatPriceOptions,
): string => {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat(options?.locale ?? 'es-AR', {
    style: 'currency',
    currency: options?.currency ?? 'ARS',
    minimumFractionDigits: 0,
  }).format(n)
}

// ─── Duration ─────────────────────────────────────────────────────────────────

export const durationLabel = (minutes: number): string => {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export const appointmentDuration = (start: string, end: string): number =>
  differenceInMinutes(parseISO(end), parseISO(start))

// ─── Availability helpers ─────────────────────────────────────────────────────

export const overlaps = (
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean => isBefore(aStart, bEnd) && isAfter(aEnd, bStart)

export const generateSlots = (
  windowStart: Date,
  windowEnd: Date,
  serviceDuration: number,
  intervalMinutes = 15,
): Date[] => {
  const slots: Date[] = []
  let cursor = windowStart
  while (!isAfter(addMinutes(cursor, serviceDuration), windowEnd)) {
    slots.push(cursor)
    cursor = addMinutes(cursor, intervalMinutes)
  }
  return slots
}

export const toTimeOnDate = (date: Date, timeStr: string): Date => {
  const [h, m] = timeStr.split(':').map(Number)
  return set(date, { hours: h, minutes: m, seconds: 0, milliseconds: 0 })
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

export const groupByDay = <T extends { start_time: string }>(
  items: T[],
): Map<string, T[]> => {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = format(parseISO(item.start_time), 'yyyy-MM-dd')
    const existing = map.get(key) ?? []
    map.set(key, [...existing, item])
  }
  return map
}

// ─── Locale-aware short labels ────────────────────────────────────────────────

/** Short weekday label, e.g. "Lun" / "Mon", honouring the active i18n language. */
export const formatShortWeekday = (date: Date): string =>
  format(date, 'EEE', { locale: currentLocale() })

/** Short month label, e.g. "Ene" / "Jan", honouring the active i18n language. */
export const formatShortMonth = (date: Date): string =>
  format(date, 'MMM', { locale: currentLocale() })

/** Long, human-readable day label, e.g. "lunes 5 de mayo" / "Monday, May 5". */
export const formatDayLong = (date: Date): string => {
  const loc = currentLocale()
  if (loc === enUS) return format(date, 'EEEE, MMMM d', { locale: loc })
  return format(date, "EEEE d 'de' MMMM", { locale: loc })
}

/** Format a date with an arbitrary pattern, using the active locale. */
export const formatWithPattern = (date: Date, pattern: string): string =>
  format(date, pattern, { locale: currentLocale() })

/** yyyy-MM-dd key (locale-independent). */
export const formatDateKey = (date: Date): string => format(date, 'yyyy-MM-dd')

// Re-export commonly used date-fns helpers so the rest of the app
// doesn't need to import date-fns directly.
export { isSameDay, isToday, isTomorrow, getDay, isWithinInterval, addMinutes, addDays, isBefore, isAfter, startOfDay, endOfDay }
