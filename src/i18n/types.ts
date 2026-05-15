import type enCommon from './locales/en/common.json'
import type enAuth from './locales/en/auth.json'
import type enDashboard from './locales/en/dashboard.json'
import type enCalendar from './locales/en/calendar.json'
import type enBooking from './locales/en/booking.json'
import type enSettings from './locales/en/settings.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common'
    resources: {
      common: typeof enCommon
      auth: typeof enAuth
      dashboard: typeof enDashboard
      calendar: typeof enCalendar
      booking: typeof enBooking
      settings: typeof enSettings
    }
  }
}
