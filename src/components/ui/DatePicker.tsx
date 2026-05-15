import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  isValid,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value: string        // YYYY-MM-DD
  onChange: (value: string) => void
  label?: string
  error?: boolean
}

const SLIDE_VARIANTS = {
  enterRight: { x: 24, opacity: 0 },
  enterLeft:  { x: -24, opacity: 0 },
  center:     { x: 0, opacity: 1 },
  exitRight:  { x: 24, opacity: 0 },
  exitLeft:   { x: -24, opacity: 0 },
}

// Abbreviated Spanish day headers (Mon-first)
const DAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

export function DatePicker({ value, onChange, error }: DatePickerProps) {
  const selectedDate = value ? parseISO(value) : new Date()
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    if (value) {
      const parsed = parseISO(value)
      return isValid(parsed) ? startOfMonth(parsed) : startOfMonth(new Date())
    }
    return startOfMonth(new Date())
  })
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<'left' | 'right'>('right')

  // Sync viewMonth when value changes externally
  useEffect(() => {
    if (value) {
      const parsed = parseISO(value)
      if (isValid(parsed)) setViewMonth(startOfMonth(parsed))
    }
  }, [value])

  const goToPrev = useCallback(() => {
    setDirection('left')
    setViewMonth((m) => subMonths(m, 1))
  }, [])

  const goToNext = useCallback(() => {
    setDirection('right')
    setViewMonth((m) => addMonths(m, 1))
  }, [])

  const handleSelect = useCallback(
    (day: Date) => {
      onChange(format(day, 'yyyy-MM-dd'))
      setOpen(false)
    },
    [onChange]
  )

  // Build calendar grid: full weeks from Mon to Sun
  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const displayLabel = value
    ? format(parseISO(value), "EEE, d MMM", { locale: es })
    : 'Seleccionar fecha'

  const monthTitle = format(viewMonth, "MMMM yyyy", { locale: es })

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
          <CalendarDays className="size-4 shrink-0 text-[var(--color-fg-muted)]" />
          <span className={cn('flex-1 text-left capitalize', !value && 'text-[var(--color-fg-placeholder)]')}>
            {displayLabel}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-3 select-none">
        {/* Month navigation */}
        <div className="mb-3 flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={goToPrev}
            className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>

          <div className="relative flex-1 overflow-hidden text-center h-5 leading-5">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.span
                key={monthTitle}
                custom={direction}
                initial={direction === 'right' ? SLIDE_VARIANTS.enterRight : SLIDE_VARIANTS.enterLeft}
                animate={SLIDE_VARIANTS.center}
                exit={direction === 'right' ? SLIDE_VARIANTS.exitLeft : SLIDE_VARIANTS.exitRight}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                className="absolute inset-0 text-sm font-semibold text-[var(--color-fg)] capitalize"
              >
                {monthTitle}
              </motion.span>
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={goToNext}
            className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="mb-1 grid grid-cols-7 text-center">
          {DAY_LABELS.map((d) => (
            <span key={d} className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-fg-muted)] py-1">
              {d}
            </span>
          ))}
        </div>

        {/* Calendar grid */}
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={monthTitle}
            custom={direction}
            initial={direction === 'right' ? SLIDE_VARIANTS.enterRight : SLIDE_VARIANTS.enterLeft}
            animate={SLIDE_VARIANTS.center}
            exit={direction === 'right' ? SLIDE_VARIANTS.exitLeft : SLIDE_VARIANTS.exitRight}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="grid grid-cols-7 gap-y-0.5"
          >
            {days.map((day) => {
              const isSelected = isSameDay(day, selectedDate)
              const isCurrentMonth = isSameMonth(day, viewMonth)
              const isTodayDay = isToday(day)

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelect(day)}
                  className={cn(
                    'relative mx-auto flex size-8 items-center justify-center rounded-full text-xs font-medium transition-all duration-100',
                    isSelected
                      ? 'bg-[var(--color-primary)] text-[var(--color-primary-fg)] shadow-sm scale-105'
                      : isCurrentMonth
                        ? 'text-[var(--color-fg)] hover:bg-[var(--color-bg-muted)]'
                        : 'text-[var(--color-fg-muted)] opacity-40 hover:bg-[var(--color-bg-muted)] hover:opacity-70'
                  )}
                >
                  {format(day, 'd')}
                  {isTodayDay && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 size-1 rounded-full bg-[var(--color-primary)]" />
                  )}
                </button>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  )
}
