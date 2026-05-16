import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '@/i18n'

export type Theme = 'light' | 'dark' | 'system'
export type Density = 'cozy' | 'compact'
export type Language = 'es' | 'en'
export type CalendarView = 'day' | 'week' | 'month'

interface UIState {
  theme: Theme
  density: Density
  language: Language
  commandOpen: boolean
  sidebarCollapsed: boolean
  calendarView: CalendarView
  // Tutorial
  tutorialOpen: boolean
  tutorialStep: number
  tutorialCompleted: boolean
  // Command palette recently-used (most-recent first, max 5)
  recentCommands: string[]
  // Actions
  setTheme: (theme: Theme) => void
  setDensity: (density: Density) => void
  setLanguage: (language: Language) => void
  setCommandOpen: (open: boolean) => void
  toggleCommand: () => void
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  setCalendarView: (v: CalendarView) => void
  // Tutorial actions
  setTutorialOpen: (v: boolean) => void
  setTutorialStep: (n: number) => void
  setTutorialCompleted: (v: boolean) => void
  pushRecentCommand: (id: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'system',
      density: 'cozy',
      language: 'es',
      commandOpen: false,
      sidebarCollapsed: false,
      calendarView: 'day',
      // Tutorial — non-persisted open/step, persisted completed
      tutorialOpen: false,
      tutorialStep: 0,
      tutorialCompleted: false,
      recentCommands: [],

      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setLanguage: (language) => { set({ language }); void i18n.changeLanguage(language) },
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCalendarView: (calendarView) => set({ calendarView }),
      setTutorialOpen: (tutorialOpen) => set({ tutorialOpen }),
      setTutorialStep: (tutorialStep) => set({ tutorialStep }),
      setTutorialCompleted: (tutorialCompleted) => set({ tutorialCompleted }),
      pushRecentCommand: (id) => set((s) => ({
        recentCommands: [id, ...s.recentCommands.filter((c) => c !== id)].slice(0, 5),
      })),
    }),
    {
      name: 'turnoalcorte-ui',
      partialize: (s) => ({
        theme: s.theme,
        density: s.density,
        language: s.language,
        sidebarCollapsed: s.sidebarCollapsed,
        calendarView: s.calendarView,
        tutorialCompleted: s.tutorialCompleted,
        recentCommands: s.recentCommands,
      }),
    }
  )
)

// Resolve system theme to actual value
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}
