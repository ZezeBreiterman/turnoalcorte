/**
 * Availability resolver — pure function, zero Supabase calls.
 *
 * The Supabase data-fetching lives in resolver.queries.ts.
 * This file only contains deterministic slot logic and is fully unit-tested.
 *
 * All timestamps must be UTC Date objects on entry. The caller is responsible
 * for timezone conversion (use lib/time.ts → toTimeOnDate + TZDate).
 */
import { addMinutes, isBefore, isAfter, parseISO, set } from 'date-fns'

// ── Input types ───────────────────────────────────────────────────────────────

export interface ScheduleRow {
  day_of_week: number // 0=Sun
  start_time: string  // "HH:mm" 24h
  end_time: string    // "HH:mm" 24h
}

export interface BlockedRange {
  start_at: string // ISO timestamp
  end_at: string
}

export interface BookedRange {
  start_time: string // ISO timestamp
  end_time: string
  buffer_before_minutes: number
  buffer_after_minutes: number
}

export interface ResolverInput {
  /** The local calendar date to generate slots for (midnight UTC of that day) */
  date: Date
  serviceDuration: number      // minutes
  serviceBufferBefore: number  // minutes
  serviceBufferAfter: number   // minutes
  schedule: ScheduleRow | null // null = barber has no schedule for this day
  timeOff: BlockedRange[]
  booked: BookedRange[]
  slotInterval?: number // default 15
}

export interface TimeSlot {
  startAt: Date
  endAt: Date
}

// ── Core ──────────────────────────────────────────────────────────────────────

/**
 * Returns available time slots for one barber+service on one date.
 * Returns [] when the barber has no schedule, is fully booked, or fully blocked.
 */
export function resolveAvailableSlots(input: ResolverInput): TimeSlot[] {
  const {
    date,
    serviceDuration,
    serviceBufferBefore,
    serviceBufferAfter,
    schedule,
    timeOff,
    booked,
    slotInterval = 15,
  } = input

  if (!schedule) return []

  const windowStart = toTimeOnDate(date, schedule.start_time)
  const windowEnd   = toTimeOnDate(date, schedule.end_time)

  if (!isBefore(windowStart, windowEnd)) return []

  // Total time a slot occupies (buffer on both sides + service)
  const totalDuration = serviceBufferBefore + serviceDuration + serviceBufferAfter

  const candidates = generateCandidates(windowStart, windowEnd, totalDuration, slotInterval)

  return candidates.filter(slot => {
    // The "occupied" window for this candidate (includes its own buffers)
    const occupiedStart = slot
    const occupiedEnd   = addMinutes(slot, totalDuration)

    // Filter against time-off blocks
    for (const block of timeOff) {
      const blockStart = parseISO(block.start_at)
      const blockEnd   = parseISO(block.end_at)
      if (overlaps(occupiedStart, occupiedEnd, blockStart, blockEnd)) return false
    }

    // Filter against booked appointments (their buffers included)
    for (const appt of booked) {
      const apptBufferedStart = addMinutes(parseISO(appt.start_time), -appt.buffer_before_minutes)
      const apptBufferedEnd   = addMinutes(parseISO(appt.end_time),   appt.buffer_after_minutes)
      if (overlaps(occupiedStart, occupiedEnd, apptBufferedStart, apptBufferedEnd)) return false
    }

    return true
  }).map(slot => ({
    startAt: addMinutes(slot, serviceBufferBefore),         // customer-visible start
    endAt:   addMinutes(slot, serviceBufferBefore + serviceDuration),
  }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCandidates(
  windowStart: Date,
  windowEnd: Date,
  totalDuration: number,
  interval: number,
): Date[] {
  const slots: Date[] = []
  let cursor = windowStart
  while (!isAfter(addMinutes(cursor, totalDuration), windowEnd)) {
    slots.push(cursor)
    cursor = addMinutes(cursor, interval)
  }
  return slots
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return isBefore(aStart, bEnd) && isAfter(aEnd, bStart)
}

function toTimeOnDate(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number)
  return set(new Date(date), { hours: h, minutes: m, seconds: 0, milliseconds: 0 })
}
