import * as Sentry from '@sentry/react'
import { useRouteError, isRouteErrorResponse } from 'react-router-dom'

export function RouteErrorBoundary() {
  const error = useRouteError()

  // Report to Sentry
  if (!isRouteErrorResponse(error)) {
    Sentry.captureException(error)
  }

  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.'

  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 p-6">
      <p className="text-sm font-semibold text-[var(--color-fg)]">Something went wrong</p>
      <p className="text-xs text-[var(--color-fg-muted)] text-center max-w-sm">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 text-xs text-[var(--color-primary)] hover:underline"
      >
        Reload page
      </button>
    </div>
  )
}
