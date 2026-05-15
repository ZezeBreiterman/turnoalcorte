import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, redirect } from 'react-router-dom'
import { getSession, getProfile, signOut } from '@/lib/auth'
import { RouteErrorBoundary } from '@/components/ui/ErrorBoundary'

// ── Route-level code splitting ────────────────────────────────────────────────
const AppShell      = lazy(() => import('@/components/layout/AppShell'))
const BookPage      = lazy(() => import('@/routes/book'))
const LoginPage     = lazy(() => import('@/routes/auth/login'))
const AuthCallback  = lazy(() => import('@/routes/auth/callback'))
const TodayPage     = lazy(() => import('@/routes/app/today'))
const CalendarPage  = lazy(() => import('@/routes/app/calendar'))
const ClientsPage   = lazy(() => import('@/routes/app/clients'))
const ServicesPage  = lazy(() => import('@/routes/app/services'))
const BarbersPage   = lazy(() => import('@/routes/app/barbers'))
const AnalyticsPage = lazy(() => import('@/routes/app/analytics'))
const SettingsPage  = lazy(() => import('@/routes/app/settings'))

// ── Loader helpers ─────────────────────────────────────────────────────────────
// React Router v7: always `return redirect(...)`, never `throw redirect(...)`.

async function redirectIfAuthed() {
  const session = await getSession()
  if (session) return redirect('/app/today')
  return null
}

async function appShellLoader() {
  const session = await getSession()
  if (!session) return redirect('/auth/login')

  const profile = await getProfile()
  if (!profile) {
    await signOut()
    return redirect('/auth/login')
  }

  return { profile }
}

async function adminLoader() {
  const session = await getSession()
  if (!session) return redirect('/auth/login')

  const profile = await getProfile()
  if (!profile) {
    await signOut()
    return redirect('/auth/login')
  }

  if (profile.role !== 'admin') return redirect('/app/today')

  return { profile }
}

// ── Suspense wrappers ─────────────────────────────────────────────────────────
function RouteLoader() {
  return (
    <div className="flex h-full min-h-64 items-center justify-center">
      <span className="size-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
    </div>
  )
}

function wrap(Component: React.LazyExoticComponent<() => React.ReactElement>) {
  return (
    <Suspense fallback={<RouteLoader />}>
      <Component />
    </Suspense>
  )
}

function GlobalLoader() {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #e5e5e5', borderTopColor: '#f97316', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────
export const router = createBrowserRouter([
  // Root redirect
  { path: '/', element: <Navigate to="/app/today" replace />, HydrateFallback: GlobalLoader },

  // Public booking flow (no auth)
  {
    path: '/book',
    element: wrap(BookPage),
  },

  // Auth routes
  {
    path: '/auth/login',
    loader: redirectIfAuthed,
    element: wrap(LoginPage),
  },
  {
    path: '/auth/callback',
    element: wrap(AuthCallback),
  },

  // Protected app shell — id='app-shell' lets children call useRouteLoaderData('app-shell')
  {
    id: 'app-shell',
    path: '/app',
    loader: appShellLoader,
    errorElement: <RouteErrorBoundary />,
    element: (
      <Suspense fallback={
        <div className="flex h-[100dvh] items-center justify-center">
          <span className="size-6 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" />
        </div>
      }>
        <AppShell />
      </Suspense>
    ),
    children: [
      { index: true, element: <Navigate to="/app/today" replace /> },

      // Barber + admin routes
      { path: 'today',    element: wrap(TodayPage),    errorElement: <RouteErrorBoundary /> },
      { path: 'calendar', element: wrap(CalendarPage), errorElement: <RouteErrorBoundary /> },
      { path: 'clients',  element: wrap(ClientsPage),  errorElement: <RouteErrorBoundary /> },
      { path: 'services', loader: adminLoader, element: wrap(ServicesPage),  errorElement: <RouteErrorBoundary /> },

      // Admin-only routes
      { path: 'barbers',   loader: adminLoader, element: wrap(BarbersPage),   errorElement: <RouteErrorBoundary /> },
      { path: 'analytics', loader: adminLoader, element: wrap(AnalyticsPage), errorElement: <RouteErrorBoundary /> },
      { path: 'settings',  loader: adminLoader, element: wrap(SettingsPage),  errorElement: <RouteErrorBoundary /> },
    ],
  },

  // 404 fallback
  { path: '*', element: <Navigate to="/app/today" replace /> },
])
