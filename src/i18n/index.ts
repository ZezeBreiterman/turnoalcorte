import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enDashboard from './locales/en/dashboard.json'
import enCalendar from './locales/en/calendar.json'
import enBooking from './locales/en/booking.json'
import enSettings from './locales/en/settings.json'

import esCommon from './locales/es/common.json'
import esAuth from './locales/es/auth.json'
import esDashboard from './locales/es/dashboard.json'
import esCalendar from './locales/es/calendar.json'
import esBooking from './locales/es/booking.json'
import esSettings from './locales/es/settings.json'

// Sync language preference from persisted Zustand store (turnoalcorte-ui key)
function getPersistedLanguage(): string {
  try {
    const raw = localStorage.getItem('turnoalcorte-ui')
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { language?: string } }
      const lang = parsed?.state?.language
      if (lang === 'en' || lang === 'es') return lang
    }
  } catch {
    // ignore
  }
  return 'es'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      auth: enAuth,
      dashboard: enDashboard,
      calendar: enCalendar,
      booking: enBooking,
      settings: enSettings,
    },
    es: {
      common: esCommon,
      auth: esAuth,
      dashboard: esDashboard,
      calendar: esCalendar,
      booking: esBooking,
      settings: esSettings,
    },
  },
  lng: getPersistedLanguage(),
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

export default i18n
