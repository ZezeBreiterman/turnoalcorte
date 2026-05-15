import { useEffect } from 'react'
import { useUIStore, resolveTheme } from '@/store/ui.store'

export function useTheme() {
  const { theme, setTheme } = useUIStore()

  useEffect(() => {
    const apply = (t: typeof theme) => {
      const resolved = resolveTheme(t)
      const root = document.documentElement
      root.setAttribute('data-theme', resolved)
      root.classList.toggle('dark', resolved === 'dark')
    }

    apply(theme)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => apply('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  const isDark = resolveTheme(theme) === 'dark'

  const toggle = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  return { theme, isDark, setTheme, toggle }
}
