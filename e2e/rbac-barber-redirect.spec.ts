import { test, expect } from '@playwright/test'

// TEST-5: RBAC — a barber-role user accessing /app/clients is redirected to
// /app/today by the AdminLoader (see src/router.tsx).
//
// Requires BARBER_PASSWORD in the env. Skips otherwise so the suite still
// runs in environments without staff credentials.

const BARBER_EMAIL = 'barber@turnoalcorte.com'
const BARBER_PASSWORD = process.env.BARBER_PASSWORD

test.describe('RBAC: barber redirect', () => {
  test('barber accessing /app/clients is redirected to /app/today', async ({ page }) => {
    test.skip(
      !BARBER_PASSWORD,
      'BARBER_PASSWORD env var not set — skipping barber RBAC test',
    )

    await page.goto('/auth/login')

    // Switch to the password tab (magic link is the default).
    await page.getByRole('button', { name: /password|contraseña/i }).first().click()

    await page.getByLabel(/email/i).fill(BARBER_EMAIL)
    await page.getByLabel(/password|contraseña/i).fill(BARBER_PASSWORD!)
    await page.getByRole('button', { name: /sign in|ingresar|iniciar sesión/i }).click()

    // After successful sign-in the app navigates to /app/today.
    await page.waitForURL(/\/app\/today\b/, { timeout: 15_000 })

    // Now try to visit /app/clients — AdminLoader should bounce us back.
    await page.goto('/app/clients')

    await page.waitForURL(/\/app\/today\b/, { timeout: 10_000 })
    expect(page.url()).toMatch(/\/app\/today\b/)
  })
})
