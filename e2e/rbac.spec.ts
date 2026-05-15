import { test as base, expect } from '@playwright/test'
import path from 'path'

const adminAuthFile = path.join(__dirname, '.auth/user.json')
const barberAuthFile = path.join(__dirname, '.auth/barber.json')

const adminRoutes = ['/app/analytics', '/app/barbers', '/app/settings', '/app/services']
const barberRestrictedRoutes = ['/app/analytics', '/app/barbers', '/app/settings']

// Helper: log in and save state to a file
async function loginAndSave(
  browser: import('@playwright/test').Browser,
  email: string,
  password: string,
  outputFile: string
) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('http://localhost:5173/auth/login')
  await page.getByRole('tab', { name: /Password/i }).click()
  await page.getByLabel(/Email/i).fill(email)
  await page.getByLabel(/Password/i).fill(password)
  await page.getByRole('button', { name: /Sign in/i }).click()
  await expect(page).toHaveURL(/\/app\/today/, { timeout: 10_000 })
  await context.storageState({ path: outputFile })
  await context.close()
}

base.describe('RBAC — Admin access', () => {
  base.beforeEach(() => {
    base.skip(!process.env.TEST_USER_EMAIL, 'No admin credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD')
  })

  for (const route of adminRoutes) {
    base(`admin can visit ${route} without redirect`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: adminAuthFile })
      const page = await context.newPage()
      await page.goto(route)
      // Should stay on the requested route (no redirect to /auth/login or /app/today)
      await expect(page).toHaveURL(new RegExp(route.replace(/\//g, '\\/')), { timeout: 8_000 })
      await context.close()
    })
  }
})

base.describe('RBAC — Barber redirect', () => {
  let barberContextReady = false

  base.beforeAll(async ({ browser }) => {
    const email = process.env.TEST_BARBER_EMAIL
    const password = process.env.TEST_BARBER_PASSWORD
    if (!email || !password) return

    await loginAndSave(browser, email, password, barberAuthFile)
    barberContextReady = true
  })

  base.beforeEach(() => {
    base.skip(
      !process.env.TEST_BARBER_EMAIL || !process.env.TEST_BARBER_PASSWORD,
      'No barber credentials — set TEST_BARBER_EMAIL and TEST_BARBER_PASSWORD'
    )
  })

  for (const route of barberRestrictedRoutes) {
    base(`barber visiting ${route} is redirected to /app/today`, async ({ browser }) => {
      if (!barberContextReady) {
        base.skip(true, 'Barber auth state not available')
        return
      }

      const context = await browser.newContext({ storageState: barberAuthFile })
      const page = await context.newPage()
      await page.goto(route)
      // Barbers should be redirected away from admin-only routes
      await expect(page).not.toHaveURL(new RegExp(route.replace(/\//g, '\\/')), { timeout: 8_000 })
      await expect(page).toHaveURL(/\/app\/today/, { timeout: 8_000 })
      await context.close()
    })
  }
})
