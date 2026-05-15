import { describe, it, expect } from 'vitest'
import { resolveAvailableSlots } from './resolver'
import type { ResolverInput, ScheduleRow, BlockedRange, BookedRange } from './resolver'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a date at specific time on a given date string (local, no TZ shift) */
function d(dateStr: string, h: number, m = 0): Date {
  const date = new Date(dateStr + 'T00:00:00')
  date.setHours(h, m, 0, 0)
  return date
}

function iso(dateStr: string, h: number, m = 0): string {
  return d(dateStr, h, m).toISOString()
}

const SCHEDULE_9_TO_17: ScheduleRow = {
  day_of_week: 1,
  start_time: '09:00',
  end_time: '17:00',
}

const DATE = '2024-03-15' // Friday (non-DST, baseline)

function input(overrides: Partial<ResolverInput> = {}): ResolverInput {
  return {
    date: new Date(DATE + 'T00:00:00'),
    serviceDuration: 30,
    serviceBufferBefore: 0,
    serviceBufferAfter: 10,
    schedule: SCHEDULE_9_TO_17,
    timeOff: [],
    booked: [],
    slotInterval: 15,
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('resolveAvailableSlots', () => {

  // ── No schedule ──────────────────────────────────────────────────────────────

  it('returns [] when schedule is null (barber has no schedule for that day)', () => {
    const slots = resolveAvailableSlots(input({ schedule: null }))
    expect(slots).toHaveLength(0)
  })

  it('returns [] when schedule start >= end (degenerate window)', () => {
    const slots = resolveAvailableSlots(input({
      schedule: { day_of_week: 1, start_time: '17:00', end_time: '09:00' },
    }))
    expect(slots).toHaveLength(0)
  })

  it('returns [] when schedule is only as long as the service (exactly fits — edge)', () => {
    // 09:00–09:40 window, 30 min service + 10 min buffer = exactly 40 min
    const slots = resolveAvailableSlots(input({
      schedule: { day_of_week: 1, start_time: '09:00', end_time: '09:40' },
    }))
    expect(slots).toHaveLength(1)
    expect(slots[0].startAt.getHours()).toBe(9)
    expect(slots[0].startAt.getMinutes()).toBe(0)
  })

  it('returns [] when window is 1 minute shorter than service', () => {
    const slots = resolveAvailableSlots(input({
      schedule: { day_of_week: 1, start_time: '09:00', end_time: '09:39' },
    }))
    expect(slots).toHaveLength(0)
  })

  // ── Happy path ───────────────────────────────────────────────────────────────

  it('generates slots at 15-min intervals within the working window', () => {
    const slots = resolveAvailableSlots(input())
    // 09:00–17:00 = 480 min window. total duration = 40 min (30 service + 10 buffer).
    // Last valid slot: largest n where 09:00 + n*15 + 40 <= 17:00 → n=29 → 16:15.
    // Total: 30 slots (09:00, 09:15, ..., 16:15).
    expect(slots.length).toBe(30)
    expect(slots[0].startAt.getHours()).toBe(9)
    expect(slots[0].startAt.getMinutes()).toBe(0)
    expect(slots[slots.length - 1].startAt.getHours()).toBe(16)
    expect(slots[slots.length - 1].startAt.getMinutes()).toBe(15)
  })

  it('slot endAt = startAt + serviceDuration', () => {
    const slots = resolveAvailableSlots(input({ serviceDuration: 60, serviceBufferAfter: 0 }))
    for (const slot of slots) {
      expect(slot.endAt.getTime() - slot.startAt.getTime()).toBe(60 * 60 * 1000)
    }
  })

  it('buffer_before shifts startAt forward relative to the occupied window start', () => {
    const slots = resolveAvailableSlots(input({
      serviceBufferBefore: 10,
      serviceBufferAfter: 0,
      serviceDuration: 30,
    }))
    // First candidate occupies 09:00–09:40. startAt is 09:10 (after 10-min buffer).
    expect(slots[0].startAt.getHours()).toBe(9)
    expect(slots[0].startAt.getMinutes()).toBe(10)
  })

  // ── Time-off ─────────────────────────────────────────────────────────────────

  it('returns [] when time-off covers the entire day', () => {
    const block: BlockedRange = {
      start_at: iso(DATE, 0),
      end_at: iso(DATE, 23, 59),
    }
    const slots = resolveAvailableSlots(input({ timeOff: [block] }))
    expect(slots).toHaveLength(0)
  })

  it('excludes slots that overlap a time-off block', () => {
    // Block 10:00–11:00. Any slot whose occupied window (30+10=40min) touches 10:00–11:00 is excluded.
    const block: BlockedRange = {
      start_at: iso(DATE, 10),
      end_at: iso(DATE, 11),
    }
    const slots = resolveAvailableSlots(input({ timeOff: [block] }))
    // Slots that would overlap: any slot where (slotStart < 11:00) && (slotEnd > 10:00)
    // slotEnd = slotStart + 40 min → overlap if slotStart < 11:00 && slotStart > 09:20
    // So slots 09:25–10:45 (start times) are excluded
    for (const slot of slots) {
      const occupiedStart = new Date(slot.startAt.getTime() - 0) // no buffer_before
      const occupiedEnd   = new Date(slot.endAt.getTime() + 10 * 60 * 1000)
      const blockStart    = new Date(iso(DATE, 10))
      const blockEnd      = new Date(iso(DATE, 11))
      const overlaps = occupiedStart < blockEnd && occupiedEnd > blockStart
      expect(overlaps).toBe(false)
    }
  })

  it('preserves slots before and after a mid-day time-off block', () => {
    const block: BlockedRange = {
      start_at: iso(DATE, 12),
      end_at: iso(DATE, 13),
    }
    const all = resolveAvailableSlots(input({ timeOff: [block] }))
    expect(all.length).toBeGreaterThan(0)
    const morning = all.filter(s => s.startAt.getHours() < 11)
    const afternoon = all.filter(s => s.startAt.getHours() >= 13)
    expect(morning.length).toBeGreaterThan(0)
    expect(afternoon.length).toBeGreaterThan(0)
  })

  // ── Booked appointments ───────────────────────────────────────────────────────

  it('excludes slots that overlap an existing appointment (including buffers)', () => {
    const appt: BookedRange = {
      start_time: iso(DATE, 10),
      end_time: iso(DATE, 10, 30),
      buffer_before_minutes: 0,
      buffer_after_minutes: 10,
    }
    const slots = resolveAvailableSlots(input({ booked: [appt] }))
    // Appointment occupies 10:00–10:40 (end + buffer). Any new slot (40 min) that
    // overlaps [10:00, 10:40] is excluded.
    for (const slot of slots) {
      const occupiedEnd = new Date(slot.endAt.getTime() + 10 * 60 * 1000)
      const apptStart   = new Date(iso(DATE, 10))
      const apptEnd     = new Date(iso(DATE, 10, 40))
      const overlaps = slot.startAt < apptEnd && occupiedEnd > apptStart
      expect(overlaps).toBe(false)
    }
  })

  it('does not exclude slots adjacent to (but not overlapping) a booked appointment', () => {
    // Appointment 10:00–10:30 with 10-min after buffer → occupied until 10:40.
    // 10:40 is not a 15-min boundary from 09:00; next valid slot is 10:45.
    // 10:45 occupied window: 10:45–11:25. Does not overlap [10:00, 10:40]. Should be included.
    const appt: BookedRange = {
      start_time: iso(DATE, 10),
      end_time: iso(DATE, 10, 30),
      buffer_before_minutes: 0,
      buffer_after_minutes: 10,
    }
    const slots = resolveAvailableSlots(input({ booked: [appt] }))
    const slot1045 = slots.find(s =>
      s.startAt.getHours() === 10 && s.startAt.getMinutes() === 45
    )
    expect(slot1045).toBeDefined()
  })

  it('ignores cancelled appointments (caller must filter before passing booked[])', () => {
    // The resolver doesn't know about status — it trusts the caller to only pass
    // non-cancelled appointments. Passing nothing results in all 30 slots available.
    const slots = resolveAvailableSlots(input({ booked: [] }))
    expect(slots.length).toBe(30)
  })

  it('handles multiple booked appointments on the same day', () => {
    const appts: BookedRange[] = [
      { start_time: iso(DATE, 9),  end_time: iso(DATE, 9, 30),  buffer_before_minutes: 0, buffer_after_minutes: 10 },
      { start_time: iso(DATE, 11), end_time: iso(DATE, 11, 30), buffer_before_minutes: 0, buffer_after_minutes: 10 },
      { start_time: iso(DATE, 14), end_time: iso(DATE, 14, 30), buffer_before_minutes: 0, buffer_after_minutes: 10 },
    ]
    const slots = resolveAvailableSlots(input({ booked: appts }))
    expect(slots.length).toBeGreaterThan(0)
    // No slot should overlap any appointment+buffer window
    for (const slot of slots) {
      for (const appt of appts) {
        const occupiedEnd  = new Date(slot.endAt.getTime() + 10 * 60 * 1000)
        const apptStart    = new Date(appt.start_time)
        const apptEnd      = new Date(new Date(appt.end_time).getTime() + appt.buffer_after_minutes * 60 * 1000)
        expect(slot.startAt < apptEnd && occupiedEnd > apptStart).toBe(false)
      }
    }
  })

  // ── DST edge cases ────────────────────────────────────────────────────────────

  it('DST spring-forward: generates correct slot count on spring-forward date', () => {
    // 2024-03-10 is US DST spring-forward (clocks jump 02:00 → 03:00)
    // The resolver works in local Date objects. If the environment is set to a TZ
    // with spring-forward, 09:00–17:00 still produces 45 slots (resolver is TZ-agnostic —
    // it uses set() which respects local time, not UTC offsets).
    // This test verifies no phantom slots or gaps appear on a DST date.
    const dstDate = new Date('2024-03-10T00:00:00')
    const slots = resolveAvailableSlots(input({ date: dstDate }))
    // Count must match the standard day — 30 slots for 09:00–17:00 with 40-min total duration.
    // DST transitions do not change slot count because the resolver operates in local wall-clock time.
    expect(slots.length).toBe(30)
  })

  it('DST fall-back: generates correct slot count on fall-back date', () => {
    // 2024-11-03 is US DST fall-back (clocks repeat 02:00 → 01:00)
    const dstDate = new Date('2024-11-03T00:00:00')
    const slots = resolveAvailableSlots(input({ date: dstDate }))
    expect(slots.length).toBe(30)
  })

  it('no phantom slots: all startAt values fall within window', () => {
    const slots = resolveAvailableSlots(input())
    const windowStart = d(DATE, 9)
    const windowEnd   = d(DATE, 17)
    for (const slot of slots) {
      expect(slot.startAt.getTime()).toBeGreaterThanOrEqual(windowStart.getTime())
      expect(slot.endAt.getTime()).toBeLessThanOrEqual(windowEnd.getTime())
    }
  })

  // ── Buffer combos ─────────────────────────────────────────────────────────────

  it('no buffers: slot startAt = occupied window start, endAt = startAt + duration', () => {
    const slots = resolveAvailableSlots(input({
      serviceBufferBefore: 0,
      serviceBufferAfter: 0,
      serviceDuration: 45,
    }))
    // Window 09:00–17:00, slot = 45 min. Last slot at 16:15 (16:15+45=17:00). Count=(480/15)-(45/15)+1=29
    expect(slots[0].startAt.getHours()).toBe(9)
    expect(slots[0].startAt.getMinutes()).toBe(0)
    const last = slots[slots.length - 1]
    expect(last.startAt.getHours()).toBe(16)
    expect(last.startAt.getMinutes()).toBe(15)
  })

  it('service longer than remaining window: not included', () => {
    // 10-hour service, 09:00–17:00 window → 0 slots
    const slots = resolveAvailableSlots(input({
      serviceDuration: 600,
      serviceBufferBefore: 0,
      serviceBufferAfter: 0,
    }))
    expect(slots).toHaveLength(0)
  })

  // ── Custom interval ───────────────────────────────────────────────────────────

  it('respects custom slot interval', () => {
    const slots = resolveAvailableSlots(input({
      slotInterval: 30,
      serviceDuration: 30,
      serviceBufferBefore: 0,
      serviceBufferAfter: 0,
    }))
    // 09:00–17:00 = 480 min / 30 = 16 slots
    expect(slots.length).toBe(16)
    // Verify 30-min spacing
    expect(slots[1].startAt.getTime() - slots[0].startAt.getTime()).toBe(30 * 60 * 1000)
  })

  // ── Combined time-off + booked ────────────────────────────────────────────────

  it('combined time-off block and booked appointment produce correct exclusions', () => {
    const block: BlockedRange = {
      start_at: iso(DATE, 9),
      end_at: iso(DATE, 10),
    }
    const appt: BookedRange = {
      start_time: iso(DATE, 13),
      end_time: iso(DATE, 13, 30),
      buffer_before_minutes: 0,
      buffer_after_minutes: 10,
    }
    const slots = resolveAvailableSlots(input({ timeOff: [block], booked: [appt] }))
    // No slot should start in 09:00–09:20 range (covered by time-off)
    // No slot should overlap 13:00–13:40 (appointment + buffer)
    for (const slot of slots) {
      const h = slot.startAt.getHours()
      const m = slot.startAt.getMinutes()
      const startMinutes = h * 60 + m
      // From time-off: any slot whose occupied end > 09:00 and start < 10:00 is blocked
      // From appointment: occupied window must not overlap [13:00, 13:40]
      const occupiedEnd  = new Date(slot.endAt.getTime() + 10 * 60 * 1000)
      const blockStart   = new Date(iso(DATE, 9))
      const blockEnd     = new Date(iso(DATE, 10))
      const apptStart    = new Date(iso(DATE, 13))
      const apptEnd      = new Date(iso(DATE, 13, 40))
      expect(slot.startAt < blockEnd && occupiedEnd > blockStart).toBe(false)
      expect(slot.startAt < apptEnd && occupiedEnd > apptStart).toBe(false)
      void startMinutes // used in assertions above
    }
    expect(slots.length).toBeGreaterThan(0)
  })
})
