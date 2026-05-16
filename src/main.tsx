import * as Sentry from '@sentry/react'
import { initSentry } from './lib/sentry'
import '@/i18n'

initSentry()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { router } from './router'
import { captureError } from './lib/sentry'
import './index.css'

function AppCrashFallback() {
  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: 'system-ui', color: '#111' }}>
      <p style={{ fontSize: 16, fontWeight: 600 }}>Something went wrong.</p>
      <p style={{ fontSize: 13, color: '#666' }}>The error has been reported. Refresh to continue.</p>
      <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
        Refresh
      </button>
    </div>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (err) => {
        console.error('[QueryClient]', err)
        captureError(err, { source: 'tanstack-mutation' })
      },
    },
  },
})

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found')

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Sentry.ErrorBoundary fallback={<AppCrashFallback />} showDialog>
        <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
        </TooltipProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--color-bg)',
              color: 'var(--color-fg)',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.875rem',
            },
          }}
        />
      </Sentry.ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>
)
