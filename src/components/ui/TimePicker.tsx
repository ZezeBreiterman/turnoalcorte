import { useState, useRef, useEffect, useCallback } from 'react'
import { Clock } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface TimePickerProps {
  value: string        // HH:mm
  onChange: (value: string) => void
  label?: string
  error?: boolean
}

// Generate slots every 15 min from 07:00 to 21:00
function generateSlots(): string[] {
  const slots: string[] = []
  for (let h = 7; h <= 21; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 21 && m > 0) break
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      slots.push(`${hh}:${mm}`)
    }
  }
  return slots
}

const ALL_SLOTS = generateSlots()

// Group slots by hour → { "07": ["07:00","07:15","07:30","07:45"], ... }
function groupByHour(slots: string[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const slot of slots) {
    const hour = slot.slice(0, 2)
    if (!map.has(hour)) map.set(hour, [])
    map.get(hour)!.push(slot)
  }
  return map
}

const HOUR_GROUPS = groupByHour(ALL_SLOTS)

function formatTriggerDisplay(slot: string): string {
  if (!slot) return 'Seleccionar hora'
  const [hStr, mStr] = slot.split(':')
  const h = parseInt(hStr, 10)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mStr} ${suffix}`
}

export function TimePicker({ value, onChange, error }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedHourRef = useRef<HTMLDivElement>(null)

  // Scroll to selected hour when popover opens
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => {
      selectedHourRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [open])

  const handleSelect = useCallback(
    (slot: string) => {
      onChange(slot)
      setOpen(false)
    },
    [onChange]
  )

  const selectedHour = value ? value.slice(0, 2) : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-[var(--radius-md)] border bg-[var(--color-bg)] px-3 text-sm text-[var(--color-fg)] shadow-[var(--shadow-sm)] transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:border-[var(--color-primary)]',
            open
              ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]'
              : 'border-[var(--color-border)] hover:border-[var(--color-fg-muted)]',
            error && 'border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]'
          )}
        >
          <Clock className="size-4 shrink-0 text-[var(--color-fg-muted)]" />
          <span className={cn('flex-1 text-left', !value && 'text-[var(--color-fg-placeholder)]')}>
            {formatTriggerDisplay(value)}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-2">
        <div
          ref={scrollRef}
          className="max-h-64 overflow-y-auto overscroll-contain pr-1"
          style={{ scrollbarWidth: 'thin' }}
        >
          {Array.from(HOUR_GROUPS.entries()).map(([hour, slots]) => {
            const isActiveHour = hour === selectedHour
            return (
              <div
                key={hour}
                ref={isActiveHour ? selectedHourRef : undefined}
                className="mb-2 last:mb-0"
              >
                {/* Hour label */}
                <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                  {parseInt(hour, 10) >= 12
                    ? `${parseInt(hour, 10) % 12 === 0 ? 12 : parseInt(hour, 10) % 12} PM`
                    : `${parseInt(hour, 10)} AM`}
                </p>

                {/* Slot pills row */}
                <div className="flex flex-wrap gap-1">
                  {slots.map((slot) => {
                    const isSelected = slot === value
                    const minutePart = slot.slice(3)
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => handleSelect(slot)}
                        className={cn(
                          'rounded-[var(--radius-sm)] px-2.5 py-1 text-xs font-medium transition-all duration-100',
                          isSelected
                            ? 'bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-sm scale-105'
                            : 'bg-[var(--color-bg-subtle)] text-[var(--color-fg)] hover:bg-[var(--color-bg-muted)] border border-transparent hover:border-[var(--color-border)]'
                        )}
                      >
                        :{minutePart}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
