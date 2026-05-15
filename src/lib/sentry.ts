import * as Sentry from '@sentry/react'
import { browserTracingIntegration } from '@sentry/react'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined

export function initSentry() {
  if (!SENTRY_DSN) return   // dev/test without DSN — silent no-op

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,   // 'development' | 'production'
    integrations: [
      browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
  })
}

/** Set user context after login */
export function setSentryUser(id: string, role: string) {
  Sentry.setUser({ id, role })
}

/** Clear user context on logout */
export function clearSentryUser() {
  Sentry.setUser(null)
}

/** Capture an error with optional extra context */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context)
    Sentry.captureException(err)
  })
}
