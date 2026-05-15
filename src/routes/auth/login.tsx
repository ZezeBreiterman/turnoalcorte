import { useState } from 'react'
import { Zap, ArrowRight, Mail, RefreshCw, Key } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTheme } from '@/hooks/useTheme'
import { useNavigate } from 'react-router-dom'

const emailSchema = z.string().email('Please enter a valid email address')

type Mode   = 'magic' | 'password'
type State  = 'idle' | 'loading' | 'sent' | 'error'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [mode,     setMode]     = useState<Mode>('magic')
  const [state,    setState]    = useState<State>('idle')
  const [error,    setError]    = useState('')
  const { isDark, toggle } = useTheme()
  const navigate = useNavigate()
  const { t } = useTranslation('auth')

  const reset = () => { setState('idle'); setError('') }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid email')
      return
    }

    setState('loading')

    if (mode === 'password') {
      const { error: err } = await supabase.auth.signInWithPassword({
        email: parsed.data,
        password,
      })
      if (err) {
        setState('error')
        setError(err.message)
      } else {
        sessionStorage.setItem('firstLogin', '1')
        navigate('/app/today', { replace: true })
      }
      return
    }

    // Magic link
    const { error: err } = await supabase.auth.signInWithOtp({
      email: parsed.data,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (err) {
      setState('error')
      setError(err.message)
    } else {
      setState('sent')
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--color-bg)] p-6 overflow-hidden">
      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--color-fg) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-[0.06]"
          style={{ background: 'radial-gradient(ellipse, var(--color-primary), transparent 70%)' }}
        />
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="absolute top-5 right-5 rounded-[var(--radius-md)] p-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-bg-subtle)] transition-colors"
        aria-label={t('toggle_theme')}
      >
        {isDark ? '☀️' : '🌙'}
      </button>

      <AnimatePresence mode="wait">
        {state === 'sent' ? (
          /* ── Sent confirmation ── */
          <motion.div
            key="sent"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-sm text-center"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mb-6 flex size-20 items-center justify-center rounded-[var(--radius-2xl)] bg-[var(--color-primary)]"
              style={{ boxShadow: '0 0 0 8px color-mix(in oklch, var(--color-primary) 15%, transparent)' }}
            >
              <Mail className="size-9 text-white" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-fg)]">{t('link_sent')}</h1>
              <p className="mt-2 text-sm text-[var(--color-fg-muted)] leading-relaxed">
                {t('link_sent_desc', { email })}
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mt-8 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4 text-left"
            >
              <p className="text-xs font-medium text-[var(--color-fg-muted)] uppercase tracking-wider mb-2">
                {t('link_sent_what')}
              </p>
              <ul className="space-y-1.5 text-xs text-[var(--color-fg-muted)]">
                {([
                  t('link_sent_hint_subject'),
                  t('link_sent_hint_expiry'),
                  t('link_sent_hint_spam'),
                ] as string[]).map((hint) => (
                  <li key={hint} className="flex items-start gap-2">
                    <span className="mt-0.5 size-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                    {hint}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={() => { setState('idle'); setEmail('') }}
              className="mt-6 inline-flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              <RefreshCw className="size-3" />
              {t('use_different_email')}
            </motion.button>
          </motion.div>
        ) : (
          /* ── Login form ── */
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 w-full max-w-sm"
          >
            {/* Logo */}
            <div className="mb-8 flex flex-col items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-primary)] shadow-lg">
                <Zap className="size-6 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-semibold tracking-tight text-[var(--color-fg)]">Turnoalcorte</h1>
                <p className="mt-1 text-sm text-[var(--color-fg-muted)]">{t('login_subtitle')}</p>
              </div>
            </div>

            {/* Mode tabs */}
            <div className="mb-4 flex gap-1 rounded-[var(--radius-lg)] bg-[var(--color-bg-muted)] p-1 border border-[var(--color-border)]">
              {([['magic', t('magic_link_tab'), Mail], ['password', t('password_tab'), Key]] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); reset() }}
                  className={[
                    'flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] px-3 py-2 text-xs font-medium transition-all duration-150',
                    mode === m
                      ? 'bg-[var(--color-bg)] text-[var(--color-fg)] shadow-sm border border-[var(--color-border)]'
                      : 'text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
                  ].join(' ')}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Form card */}
            <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-bg)] p-7 shadow-[var(--shadow-xl)]">
              <h2 className="mb-1.5 text-base font-semibold text-[var(--color-fg)]">{t('staff_sign_in')}</h2>
              <p className="mb-5 text-sm text-[var(--color-fg-muted)]">
                {mode === 'magic' ? t('magic_prompt') : t('password_prompt')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-medium text-[var(--color-fg-muted)]">
                    {t('email_label')}
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('email_placeholder')}
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (error) setError(''); if (state === 'error') setState('idle') }}
                    error={!!error && !password}
                    autoComplete="email"
                    autoFocus
                    className="h-10"
                  />
                </div>

                <AnimatePresence>
                  {mode === 'password' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1.5 pt-0.5">
                        <label htmlFor="password" className="block text-xs font-medium text-[var(--color-fg-muted)]">
                          {t('password_label')}
                        </label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={e => { setPassword(e.target.value); if (error) setError(''); if (state === 'error') setState('idle') }}
                          error={!!error}
                          autoComplete="current-password"
                          className="h-10"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <p className="text-xs text-[var(--color-danger)]" role="alert">{error}</p>
                )}

                <Button type="submit" className="w-full h-10 gap-2" loading={state === 'loading'}>
                  {state !== 'loading' && (
                    <>
                      {mode === 'magic' ? t('send_link') : t('sign_in')}
                      <ArrowRight className="size-4" />
                    </>
                  )}
                  {state === 'loading' && (mode === 'magic' ? t('sending') : t('signing_in'))}
                </Button>
              </form>
            </div>

            <p className="mt-6 text-center text-xs text-[var(--color-fg-subtle)]">
              {t('barbers_only')}{' '}
              <a href="/book" className="text-[var(--color-primary)] hover:underline">{t('book_link')}</a>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
