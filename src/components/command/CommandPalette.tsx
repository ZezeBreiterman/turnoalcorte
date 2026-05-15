import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import {
  CalendarClock,
  Calendar,
  Users,
  Scissors,
  User,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Search,
  Plus,
  Phone,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUIStore } from '@/store/ui.store'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import type { Client } from '@/types/database'

// ── Nav commands ──────────────────────────────────────────────────────────────

const NAV_COMMANDS = [
  { label: 'Today',     icon: CalendarClock, to: '/app/today' },
  { label: 'Calendar',  icon: Calendar,      to: '/app/calendar' },
  { label: 'Clients',   icon: Users,         to: '/app/clients' },
  { label: 'Services',  icon: Scissors,      to: '/app/services' },
  { label: 'Barbers',   icon: User,          to: '/app/barbers' },
  { label: 'Analytics', icon: BarChart3,     to: '/app/analytics' },
  { label: 'Settings',  icon: Settings,      to: '/app/settings' },
]

// ── Item style ────────────────────────────────────────────────────────────────

const itemCls = cn(
  'flex cursor-default items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm',
  'text-[var(--color-fg)] transition-colors duration-100',
  'aria-selected:bg-[var(--color-bg-subtle)] aria-selected:text-[var(--color-fg)]'
)

const groupCls = cn(
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
  '[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold',
  '[&_[cmdk-group-heading]]:text-[var(--color-fg-muted)]',
  '[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider',
  'mt-1'
)

// ── Component ─────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const { commandOpen, setCommandOpen } = useUIStore()
  const { isDark, setTheme } = useTheme()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [searchingClients, setSearchingClients] = useState(false)

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(true)
      }
      if (e.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setCommandOpen])

  // Reset search when closed
  useEffect(() => {
    if (!commandOpen) {
      setSearch('')
      setClients([])
    }
  }, [commandOpen])

  // Debounced client search
  const searchClients = useCallback(async (q: string) => {
    if (q.length < 2) { setClients([]); return }
    setSearchingClients(true)
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, email')
        .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(5)
      setClients((data ?? []) as Client[])
    } finally {
      setSearchingClients(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => searchClients(search), 250)
    return () => clearTimeout(timer)
  }, [search, searchClients])

  const runAndClose = (fn: () => void) => { fn(); setCommandOpen(false) }

  if (!commandOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setCommandOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className={cn(
          'relative z-10 w-full max-w-lg overflow-hidden',
          'rounded-[var(--radius-xl)] border border-[var(--color-border)]',
          'bg-[var(--color-bg)] shadow-[var(--shadow-xl)]',
          'animate-in fade-in-0 zoom-in-95 duration-150'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-[var(--color-border)]">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
            <Search className="size-4 shrink-0 text-[var(--color-fg-muted)]" />
            <Command.Input
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="Search commands or clients…"
              className={cn(
                'flex-1 bg-transparent text-sm text-[var(--color-fg)] placeholder:text-[var(--color-fg-muted)]',
                'outline-none border-none'
              )}
            />
            <kbd className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-fg-muted)]">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-[var(--color-fg-muted)]">
              {searchingClients ? 'Searching…' : 'No results found.'}
            </Command.Empty>

            {/* Actions */}
            <Command.Group heading="Actions" className={groupCls}>
              <Command.Item
                value="new appointment add"
                onSelect={() => runAndClose(() => navigate('/app/today?new=1'))}
                className={itemCls}
              >
                <Plus className="size-4 text-[var(--color-primary)]" />
                New appointment
              </Command.Item>
            </Command.Group>

            {/* Client search results */}
            {clients.length > 0 && (
              <Command.Group heading="Clients" className={groupCls}>
                {clients.map((c) => (
                  <Command.Item
                    key={c.id}
                    value={`client-${c.id}`}
                    onSelect={() => runAndClose(() => navigate('/app/clients'))}
                    className={itemCls}
                  >
                    <Users className="size-4 text-[var(--color-fg-muted)] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{c.name}</p>
                      {c.phone && (
                        <p className="text-xs text-[var(--color-fg-muted)] flex items-center gap-1 mt-0.5">
                          <Phone className="size-3" />
                          {c.phone}
                        </p>
                      )}
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Navigation */}
            <Command.Group heading="Navigation" className={groupCls}>
              {NAV_COMMANDS.filter((cmd) =>
                !search || cmd.label.toLowerCase().includes(search.toLowerCase())
              ).map(({ label, icon: Icon, to }) => (
                <Command.Item
                  key={to}
                  value={label}
                  onSelect={() => runAndClose(() => navigate(to))}
                  className={itemCls}
                >
                  <Icon className="size-4 text-[var(--color-fg-muted)]" />
                  {label}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Appearance */}
            <Command.Group heading="Appearance" className={groupCls}>
              <Command.Item
                value="toggle theme dark light mode"
                onSelect={() => runAndClose(() => setTheme(isDark ? 'light' : 'dark'))}
                className={itemCls}
              >
                {isDark
                  ? <Sun className="size-4 text-[var(--color-fg-muted)]" />
                  : <Moon className="size-4 text-[var(--color-fg-muted)]" />
                }
                Switch to {isDark ? 'Light' : 'Dark'} mode
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
