/**
 * Global UI state — Zustand store persisted to localStorage.
 *
 * Scope: only state that genuinely cannot live in TanStack Query's server cache.
 * Examples: theme preference, sidebar collapsed state, selected calendar view.
 *
 * Persisted keys (survive page refresh):
 *   theme, density, language, sidebarCollapsed, calendarView,
 *   tutorialCompleted, recentCommands
 *
 * Transient keys (reset on every load):
 *   commandOpen, tutorialOpen, tutorialStep
 *
 * Storage key: 'turnoalcorte-ui' in localStorage.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '@/i18n'

export type Theme        = 'light' | 'dark' | 'system'
export type Density      = 'cozy' | 'compact'
export type Language     = 'es' | 'en'
export type CalendarView = 'day' | 'week' | 'month'

interface UIState {
  // ── Persisted preferences ──────────────────────────────────────────────────
  theme: Theme
  density: Density
  language: Language
  sidebarCollapsed: boolean
  calendarView: CalendarView
  tutorialCompleted: boolean
  /** Most-recently-used command IDs (max 5, most recent first). */
  recentCommands: string[]

  // ── Transient session state ────────────────────────────────────────────────
  commandOpen: boolean
  tutorialOpen: boolean
  tutorialStep: number

  // ── Actions ────────────────────────────────────────────────────────────────
  setTheme: (theme: Theme) => void
  setDensity: (density: Density) => void
  /** Changes the language and immediately calls i18next.changeLanguage(). */
  setLanguage: (language: Language) => void
  setCommandOpen: (open: boolean) => void
  toggleCommand: () => void
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  setCalendarView: (v: CalendarView) => void
  setTutorialOpen: (v: boolean) => void
  setTutorialStep: (n: number) => void
  setTutorialCompleted: (v: boolean) => void
  /**
   * Push a command ID to the recents list. Deduplicates (moves existing to
   * front) and caps the list at 5 entries.
   */
  pushRecentCommand: (id: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Defaults
      theme:             'system',
      density:           'cozy',
      language:          'es',
      commandOpen:       false,
      sidebarCollapsed:  false,
      calendarView:      'day',
      tutorialOpen:      false,
      tutorialStep:      0,
      tutorialCompleted: false,
      recentCommands:    [],

      setTheme:   (theme)   => set({ theme }),
      setDensity: (density) => set({ density }),
      setLanguage: (language) => {
        set({ language })
        void i18n.changeLanguage(language)
      },
      setCommandOpen:      (commandOpen)      => set({ commandOpen }),
      toggleCommand:       ()                 => set((s) => ({ commandOpen: !s.commandOpen })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar:       ()                 => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCalendarView:     (calendarView)     => set({ calendarView }),
      setTutorialOpen:     (tutorialOpen)     => set({ tutorialOpen }),
      setTutorialStep:     (tutorialStep)     => set({ tutorialStep }),
      setTutorialCompleted:(tutorialCompleted)=> set({ tutorialCompleted }),
      pushRecentCommand: (id) => set((s) => ({
        recentCommands: [id, ...s.recentCommands.filter((c) => c !== id)].slice(0, 5),
      })),
    }),
    {
      name: 'turnoalcorte-ui',
      // Only persist user preferences — transient state resets on every load.
      partialize: (s) => ({
        theme:             s.theme,
        density:           s.density,
        language:          s.language,
        sidebarCollapsed:  s.sidebarCollapsed,
        calendarView:      s.calendarView,
        tutorialCompleted: s.tutorialCompleted,
        recentCommands:    s.recentCommands,
      }),
    }
  )
)

/**
 * Resolves `'system'` to the actual OS preference.
 * Use this when you need a concrete 'light' | 'dark' value to apply a CSS class.
 */
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}
