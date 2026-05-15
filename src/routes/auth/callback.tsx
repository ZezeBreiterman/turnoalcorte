import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Zap } from 'lucide-react'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        sessionStorage.setItem('firstLogin', '1')
        navigate('/app/today', { replace: true })
      } else if (event === 'TOKEN_REFRESHED' && session) {
        navigate('/app/today', { replace: true })
      }
    })

    // Handle hash-based token from Supabase email link
    supabase.auth.getSession().then(({ data: { session }, error: err }) => {
      if (err) {
        setError(err.message)
        return
      }
      if (session) {
        sessionStorage.setItem('firstLogin', '1')
        navigate('/app/today', { replace: true })
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [navigate])

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)] p-6">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-[var(--color-danger)]">Authentication failed</p>
          <p className="text-xs text-[var(--color-fg-muted)]">{error}</p>
          <a href="/auth/login" className="text-xs text-[var(--color-primary)] hover:underline">
            Try again →
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-bg)]">
      <div className="flex size-12 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-primary)]">
        <Zap className="size-6 text-white" />
      </div>
      <div className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)]">
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        Signing you in…
      </div>
    </div>
  )
}
