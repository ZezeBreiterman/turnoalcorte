import { useEffect } from 'react'
import { NavLink, Outlet, useRouteLoaderData } from 'react-router-dom'
import { CalendarClock, Calendar, Users } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { CommandPalette } from '@/components/command/CommandPalette'
import { TutorialOverlay } from '@/components/onboarding/TutorialOverlay'
import { useTheme } from '@/hooks/useTheme'
import { useDensity } from '@/hooks/useDensity'
import { useUIStore } from '@/store/ui.store'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/auth'

const MOBILE_NAV = [
  { to: '/app/today',    icon: CalendarClock, label: 'Today' },
  { to: '/app/calendar', icon: Calendar,      label: 'Calendar' },
  { to: '/app/clients',  icon: Users,         label: 'Clients' },
]

export default function AppShell() {
  useTheme()
  useDensity()

  const loaderData = useRouteLoaderData('app-shell') as { profile: Profile } | null
  const role = loaderData?.profile.role ?? 'barber'

  const { tutorialCompleted, setTutorialOpen, setTutorialStep } = useUIStore()

  // Auto-launch tutorial on first login
  useEffect(() => {
    const isFirstLogin = sessionStorage.getItem('firstLogin') === '1'
    if (isFirstLogin && !tutorialCompleted) {
      sessionStorage.removeItem('firstLogin')
      setTutorialStep(0)
      setTutorialOpen(true)
    }
  }, [tutorialCompleted, setTutorialOpen, setTutorialStep])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--color-bg)]">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>

        {/* Mobile bottom nav — visible only on small screens */}
        <nav className="md:hidden flex shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)]"
          aria-label="Mobile navigation"
        >
          {MOBILE_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-xs font-medium transition-colors',
                isActive
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
              )}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </NavLink>
          ))}
          {role === 'admin' && (
            <NavLink
              to="/app/settings"
              className={({ isActive }) => cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-xs font-medium transition-colors',
                isActive
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
              )}
            >
              <Users className="size-5" />
              <span>More</span>
            </NavLink>
          )}
        </nav>
      </div>

      {/* Global command palette */}
      <CommandPalette />

      {/* Onboarding tutorial */}
      <TutorialOverlay />
    </div>
  )
}
