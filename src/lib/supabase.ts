import { createClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/react'
import { env } from './env'

export const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

supabase.auth.onAuthStateChange((event, session) => {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: event,
    level: 'info',
    data: { userId: session?.user?.id },
  })
})

export type SupabaseUser = NonNullable<
  Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user']
>
