import { useEffect, useState } from 'react'
import { NavLink, Outlet, useRouteLoaderData, useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  Calendar,
  Users,
  Menu,
  Scissors,
  User,
  BarChart3,
  Settings,
  X,
  LogOut,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { CommandPalette } from '@/components/command/CommandPalette'
import { TutorialOverlay } from '@/components/onboarding/TutorialOverlay'
import { useTheme } from '@/hooks/useTheme'
import { useDensity } from '@/hooks/useDensity'
import { useUIStore } from '@/store/ui.store'
import { signOut } from '@/lib/auth'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/auth'
import { can } from '@/lib/can'

const MOBILE_NAV_PRIMARY = [
  { to: '/app/today',    icon: CalendarClock, label: 'Today' },
  { to: '/app/calendar', icon: Calendar,      label: 'Calendar' },
  { to: '/app/clients',  icon: Users,         label: 'Clients' },
]

const MOBILE_NAV_ADMIN = [
  { to: '/app/services',  icon: Scissors,  label: 'Services' },
  { to: '/app/barbers',   icon: User,      label: 'Barbers' },
  { to: '/app/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/app/settings',  icon: Settings,  label: 'Settings' },
]

export default function AppShell() {
  useTheme()
  useDensity()

  const loaderData = useRouteLoaderData('app-shell') as { profile: Profile } | null
  const role = loaderData?.profile.role ?? 'barber'
  // Admin-only nav (services/barbers/analytics/settings) — centralized via can()
  const isAdmin = can(role, 'update', 'settings')

  const { tutorialCompleted, setTutorialOpen, setTutorialStep } = useUIStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const isFirstLogin = sessionStorage.getItem('firstLogin') === '1'
    if (isFirstLogin && !tutorialCompleted) {
      sessionStorage.removeItem('firstLogin')
      setTutorialStep(0)
      setTutorialOpen(true)
    }
  }, [tutorialCompleted, setTutorialOpen, setTutorialStep])

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth/login', { replace: true })
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--color-bg)]">
      {/* Desktop sidebar — hidden on mobile */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden flex shrink-0 border-t border-[var(--color-border)] bg-[var(--color-bg)]"
          aria-label="Mobile navigation"
        >
          {MOBILE_NAV_PRIMARY.map(({ to, icon: Icon, label }) => (
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

          {/* Menu button — only for admin, opens the full nav sheet */}
          {isAdmin && (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-xs font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
              <span>Menu</span>
            </button>
          )}
        </nav>
      </div>

      {/* Mobile admin menu sheet */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-72 flex flex-col bg-[var(--color-bg)] border-l border-[var(--color-border)] shadow-2xl md:hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-primary)]">
                    <img src="/favicon.png" alt="" className="size-full object-contain invert p-0.5" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-fg)]">Turnoalcorte</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)] transition-colors"
                  aria-label="Close menu"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Nav items */}
              <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
                {MOBILE_NAV_ADMIN.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                        : 'text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]'
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </NavLink>
                ))}
              </nav>

              {/* User footer */}
              {loaderData?.profile && (
                <div className="border-t border-[var(--color-border)] px-3 py-3 space-y-1">
                  <div className="flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-[10px] font-semibold uppercase">
                      {loaderData.profile.email.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium text-[var(--color-fg)]">
                        {loaderData.profile.email}
                      </p>
                      <p className="text-[10px] text-[var(--color-fg-muted)] capitalize">
                        {loaderData.profile.role}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                  >
                    <LogOut className="size-4 shrink-0" />
                    Sign out
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Global command palette */}
      <CommandPalette />

      {/* Onboarding tutorial */}
      <TutorialOverlay />
    </div>
  )
}
