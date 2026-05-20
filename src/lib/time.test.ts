import { describe, it, expect } from 'vitest'
import {
  now,
  today,
  todayEnd,
  parseTimestamp,
  parseDate,
  formatTime,
  formatDate,
  formatDateShort,
  formatTimeRange,
  formatPrice,
  durationLabel,
  appointmentDuration,
  overlaps,
  generateSlots,
  toTimeOnDate,
  groupByDay,
  formatDateKey,
  addDays,
  getDay,
  startOfDay,
  endOfDay,
} from './time'

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Build a local-time Date at the given wall-clock components. */
function d(year: number, month1: number, day: number, h = 0, m = 0): Date {
  return new Date(year, month1 - 1, day, h, m, 0, 0)
}

// ── Primitives ─────────────────────────────────────────────────────────────────

describe('now / today / todayEnd', () => {
  it('now() returns a Date close to the current moment', () => {
    const n = now()
    expect(n).toBeInstanceOf(Date)
    expect(Math.abs(n.getTime() - Date.now())).toBeLessThan(1000)
  })

  it('today() is the start of the current day (midnight local)', () => {
    const t = today()
    expect(t.getHours()).toBe(0)
    expect(t.getMinutes()).toBe(0)
    expect(t.getSeconds()).toBe(0)
    expect(t.getMilliseconds()).toBe(0)
  })

  it('todayEnd() is later than today() (same calendar day)', () => {
    expect(todayEnd().getTime()).toBeGreaterThan(today().getTime())
    expect(todayEnd().getDate()).toBe(today().getDate())
  })
})

// ── parseTimestamp / parseDate ─────────────────────────────────────────────────

describe('parseTimestamp / parseDate', () => {
  it('parseTimestamp round-trips an ISO instant', () => {
    const iso = '2024-03-15T14:30:00.000Z'
    const parsed = parseTimestamp(iso)
    expect(parsed.toISOString()).toBe(iso)
  })

  it('parseDate normalizes to start of day (local)', () => {
    const parsed = parseDate('2024-03-15T14:30:00.000Z')
    // parseISO returns the instant; startOfDay drops to local midnight.
    expect(parsed.getHours()).toBe(0)
    expect(parsed.getMinutes()).toBe(0)
    expect(parsed.getSeconds()).toBe(0)
    expect(parsed.getMilliseconds()).toBe(0)
  })
})

// ── Formatters ─────────────────────────────────────────────────────────────────

describe('formatTime', () => {
  it('formats morning time with 12-hour pattern (h:mm a)', () => {
    // 09:05 local
    expect(formatTime(d(2024, 3, 15, 9, 5))).toBe('9:05 AM')
  })

  it('formats afternoon time as PM', () => {
    expect(formatTime(d(2024, 3, 15, 14, 30))).toBe('2:30 PM')
  })

  it('accepts an ISO string input', () => {
    // Build an ISO string from a local 10:15 date so the rendered local hour matches.
    const iso = d(2024, 3, 15, 10, 15).toISOString()
    expect(formatTime(iso)).toBe('10:15 AM')
  })
})

describe('formatDate / formatDateShort', () => {
  it('formats as dd/MM/yyyy', () => {
    expect(formatDate(d(2024, 3, 15))).toBe('15/03/2024')
  })

  it('short form is dd/MM', () => {
    expect(formatDateShort(d(2024, 3, 15))).toBe('15/03')
  })
})

describe('formatTimeRange', () => {
  it('joins two times with an en-dash separator', () => {
    const out = formatTimeRange(d(2024, 3, 15, 9, 0), d(2024, 3, 15, 9, 30))
    expect(out).toBe('9:00 AM – 9:30 AM')
  })
})

describe('formatPrice', () => {
  it('formats a number as ARS currency (es-AR) with no decimals', () => {
    const out = formatPrice(1500)
    // Locale-formatted strings may use NBSP / NNBSP between symbol and digits.
    // Assert symbol + digits both appear; tolerate whitespace variants.
    expect(out).toContain('$')
    expect(out).toMatch(/1\.500/)
    // Should not include a fractional component.
    expect(out).not.toMatch(/[.,]00\b/)
  })

  it('accepts a numeric string', () => {
    expect(formatPrice('1500')).toBe(formatPrice(1500))
  })

  it('honours the locale override', () => {
    const out = formatPrice(1500, { locale: 'en-US', currency: 'USD' })
    expect(out).toContain('$')
    expect(out).toMatch(/1,500/)
  })
})

// ── Duration ───────────────────────────────────────────────────────────────────

describe('durationLabel', () => {
  it('returns minutes-only for sub-hour durations', () => {
    expect(durationLabel(30)).toBe('30m')
    expect(durationLabel(45)).toBe('45m')
  })

  it('returns whole-hour form when minutes are zero', () => {
    expect(durationLabel(60)).toBe('1h')
    expect(durationLabel(120)).toBe('2h')
  })

  it('combines hours and minutes when both present', () => {
    expect(durationLabel(90)).toBe('1h 30m')
    expect(durationLabel(135)).toBe('2h 15m')
  })
})

describe('appointmentDuration', () => {
  it('returns minutes between two ISO timestamps', () => {
    const start = d(2024, 3, 15, 9, 0).toISOString()
    const end = d(2024, 3, 15, 9, 45).toISOString()
    expect(appointmentDuration(start, end)).toBe(45)
  })
})

// ── Availability helpers ───────────────────────────────────────────────────────

describe('overlaps', () => {
  it('returns true for overlapping ranges', () => {
    expect(overlaps(
      d(2024, 3, 15, 9, 0),  d(2024, 3, 15, 10, 0),
      d(2024, 3, 15, 9, 30), d(2024, 3, 15, 10, 30),
    )).toBe(true)
  })

  it('returns false for back-to-back ranges (touching boundary)', () => {
    expect(overlaps(
      d(2024, 3, 15, 9, 0),  d(2024, 3, 15, 10, 0),
      d(2024, 3, 15, 10, 0), d(2024, 3, 15, 11, 0),
    )).toBe(false)
  })

  it('returns false for fully disjoint ranges', () => {
    expect(overlaps(
      d(2024, 3, 15, 9, 0),  d(2024, 3, 15, 10, 0),
      d(2024, 3, 15, 14, 0), d(2024, 3, 15, 15, 0),
    )).toBe(false)
  })
})

describe('generateSlots', () => {
  it('produces 2 slots in a 60-min window for a 30-min service at 30-min interval', () => {
    const slots = generateSlots(
      d(2024, 3, 15, 9, 0),
      d(2024, 3, 15, 10, 0),
      30,
      30,
    )
    expect(slots).toHaveLength(2)
    expect(slots[0].getHours()).toBe(9)
    expect(slots[0].getMinutes()).toBe(0)
    expect(slots[1].getHours()).toBe(9)
    expect(slots[1].getMinutes()).toBe(30)
  })

  it('default 15-min interval generates the expected count for a 1h window / 30m service', () => {
    // 09:00, 09:15, 09:30 — 09:30 + 30 = 10:00 fits exactly. 09:45 + 30 = 10:15 overflows.
    const slots = generateSlots(
      d(2024, 3, 15, 9, 0),
      d(2024, 3, 15, 10, 0),
      30,
    )
    expect(slots).toHaveLength(3)
    expect(slots.map(s => s.getMinutes())).toEqual([0, 15, 30])
  })

  it('returns [] if the service is longer than the window', () => {
    const slots = generateSlots(
      d(2024, 3, 15, 9, 0),
      d(2024, 3, 15, 9, 20),
      30,
    )
    expect(slots).toHaveLength(0)
  })
})

describe('toTimeOnDate', () => {
  it('combines a date with an HH:mm string', () => {
    const out = toTimeOnDate(d(2024, 3, 15, 8, 47, ), '14:30')
    expect(out.getFullYear()).toBe(2024)
    expect(out.getMonth()).toBe(2) // March = 2
    expect(out.getDate()).toBe(15)
    expect(out.getHours()).toBe(14)
    expect(out.getMinutes()).toBe(30)
    expect(out.getSeconds()).toBe(0)
    expect(out.getMilliseconds()).toBe(0)
  })

  it('zero-pads single-digit hour strings', () => {
    const out = toTimeOnDate(d(2024, 3, 15), '09:05')
    expect(out.getHours()).toBe(9)
    expect(out.getMinutes()).toBe(5)
  })
})

// ── Grouping ───────────────────────────────────────────────────────────────────

describe('groupByDay', () => {
  it('groups items by their yyyy-MM-dd start_time key', () => {
    const items = [
      { start_time: d(2024, 3, 15, 9, 0).toISOString(),  id: 'a' },
      { start_time: d(2024, 3, 15, 14, 0).toISOString(), id: 'b' },
      { start_time: d(2024, 3, 16, 10, 0).toISOString(), id: 'c' },
    ]
    const grouped = groupByDay(items)
    expect(grouped.size).toBe(2)
    expect(grouped.get('2024-03-15')).toHaveLength(2)
    expect(grouped.get('2024-03-16')).toHaveLength(1)
    expect(grouped.get('2024-03-15')?.map(i => i.id)).toEqual(['a', 'b'])
  })

  it('returns an empty map for an empty input', () => {
    expect(groupByDay([]).size).toBe(0)
  })
})

// ── Date keys / date-fns re-exports ────────────────────────────────────────────

describe('formatDateKey', () => {
  it('returns yyyy-MM-dd', () => {
    expect(formatDateKey(d(2024, 3, 15))).toBe('2024-03-15')
    expect(formatDateKey(d(2024, 12, 1))).toBe('2024-12-01')
  })
})

describe('re-exported date helpers', () => {
  it('addDays adds calendar days', () => {
    const out = addDays(d(2024, 3, 15), 3)
    expect(out.getDate()).toBe(18)
    expect(out.getMonth()).toBe(2)
  })

  it('getDay returns 0..6 (0=Sunday)', () => {
    // 2024-03-15 is a Friday → 5
    expect(getDay(d(2024, 3, 15))).toBe(5)
  })

  it('startOfDay / endOfDay frame a calendar day', () => {
    const s = startOfDay(d(2024, 3, 15, 14, 30))
    const e = endOfDay(d(2024, 3, 15, 14, 30))
    expect(s.getHours()).toBe(0)
    expect(s.getMinutes()).toBe(0)
    expect(e.getHours()).toBe(23)
    expect(e.getMinutes()).toBe(59)
    expect(e.getTime()).toBeGreaterThan(s.getTime())
  })
})

// ── i18n-dependent helpers ─────────────────────────────────────────────────────

describe.skip('formatShortWeekday / formatShortMonth / formatDayLong', () => {
  // Skipped: these helpers depend on the live i18next instance language. Testing
  // them reliably requires stubbing i18n, which is out of scope for this suite.
  it.skip('placeholder', () => {})
})
