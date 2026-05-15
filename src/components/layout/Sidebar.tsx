import { NavLink, useLocation, useRouteLoaderData } from 'react-router-dom'
import {
  CalendarClock,
  Calendar,
  Users,
  Scissors,
  User,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui.store'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { signOut } from '@/lib/auth'
import type { Profile } from '@/lib/auth'

interface NavItemDef {
  to: string
  icon: React.ElementType
  labelKey: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItemDef[] = [
  { to: '/app/today',     icon: CalendarClock, labelKey: 'nav.today' },
  { to: '/app/calendar',  icon: Calendar,      labelKey: 'nav.calendar' },
  { to: '/app/clients',   icon: Users,         labelKey: 'nav.clients' },
  { to: '/app/services',  icon: Scissors,      labelKey: 'nav.services',  adminOnly: true },
  { to: '/app/barbers',   icon: User,          labelKey: 'nav.barbers',   adminOnly: true },
  { to: '/app/analytics', icon: BarChart3,     labelKey: 'nav.analytics', adminOnly: true },
  { to: '/app/settings',  icon: Settings,      labelKey: 'nav.settings',  adminOnly: true },
]

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const collapsed = sidebarCollapsed
  const { t } = useTranslation('common')

  // Profile comes from the app-shell loader — always available inside /app
  const loaderData = useRouteLoaderData('app-shell') as { profile: Profile } | null
  const role = loaderData?.profile.role ?? 'barber'
  const isAdmin = role === 'admin'

  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)

  return (
    <TooltipProvider>
      <motion.aside
        animate={{ width: collapsed ? 60 : 220 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'relative hidden md:flex flex-col shrink-0 h-full overflow-hidden',
          'bg-[var(--color-sidebar-bg)] border-r border-[var(--color-sidebar-border)]',
          className
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-2.5 h-14 border-b border-[var(--color-sidebar-border)] shrink-0',
          collapsed ? 'px-3.5 justify-center' : 'px-4'
        )}>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary)]">
            <Zap className="size-4 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="text-sm font-semibold text-[var(--color-sidebar-fg)] tracking-tight whitespace-nowrap"
              >
                Turnoalcorte
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleItems.map(({ to, icon: Icon, labelKey }) => (
            <NavItem
              key={to}
              to={to}
              icon={<Icon className="size-4 shrink-0" />}
              label={t(labelKey as 'nav.today')}
              collapsed={collapsed}
            />
          ))}
        </nav>

        {/* User + collapse footer */}
        <div className="border-t border-[var(--color-sidebar-border)] p-2 space-y-0.5">
          {/* User info row */}
          {loaderData?.profile && (
            <div className={cn(
              'flex items-center rounded-[var(--radius-md)] px-2 py-1.5',
              collapsed ? 'justify-center' : 'gap-2'
            )}>
              <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-[10px] font-semibold uppercase">
                {loaderData.profile.email.charAt(0)}
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.12 }}
                    className="flex-1 min-w-0"
                  >
                    <p className="truncate text-xs font-medium text-[var(--color-sidebar-fg)]">
                      {loaderData.profile.email}
                    </p>
                    <p className="text-[10px] text-[var(--color-sidebar-fg-muted)] capitalize">
                      {loaderData.profile.role}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {!collapsed && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => signOut()}
                    className="shrink-0 rounded p-0.5 text-[var(--color-sidebar-fg-muted)] hover:text-[var(--color-sidebar-fg)] transition-colors"
                    aria-label="Sign out"
                  >
                    <LogOut className="size-3.5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className={cn(
              'flex w-full items-center rounded-[var(--radius-md)] px-2 py-2 text-xs',
              'text-[var(--color-sidebar-fg-muted)] hover:text-[var(--color-sidebar-fg)]',
              'hover:bg-[var(--color-sidebar-hover)] transition-colors duration-150',
              collapsed ? 'justify-center' : 'gap-2'
            )}
            aria-label={collapsed ? 'Expand sidebar' : t('collapse')}
          >
            {collapsed
              ? <ChevronRight className="size-4" />
              : <>
                  <ChevronLeft className="size-4" />
                  <span>{t('collapse')}</span>
                </>
            }
          </button>
        </div>
      </motion.aside>
    </TooltipProvider>
  )
}

// ── NavItem ───────────────────────────────────────────────────────────────────

interface NavItemProps {
  to: string
  icon: React.ReactNode
  label: string
  collapsed: boolean
}

function NavItem({ to, icon, label, collapsed }: NavItemProps) {
  const location = useLocation()
  const isActive = location.pathname.startsWith(to)

  const inner = (
    <NavLink
      to={to}
      className={cn(
        'relative flex items-center rounded-[var(--radius-md)] px-2.5 py-2 text-sm transition-all duration-150',
        collapsed ? 'justify-center' : 'gap-2.5',
        isActive
          ? 'bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-fg)]'
          : 'text-[var(--color-sidebar-fg-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-fg)]'
      )}
    >
      {isActive && (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-[var(--color-primary)]"
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
      {icon}
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.12 }}
            className="truncate font-medium"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </NavLink>
  )

  if (collapsed) {
    return (
      <Tooltip content={label} side="right" sideOffset={10}>
        {inner}
      </Tooltip>
    )
  }

  return inner
}
