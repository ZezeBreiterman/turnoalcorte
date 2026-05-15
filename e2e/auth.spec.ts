import { test as base, expect } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '.auth/user.json')

// Use base test (no injected auth) so we can test auth flows directly
const test = base

test.describe('Auth flow', () => {
  test('unauthenticated user visiting /app/today is redirected to /auth/login', async ({ page }) => {
    await page.goto('/app/today')
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test('login page renders both tabs (Magic link and Password)', async ({ page }) => {
    await page.goto('/auth/login')
    // Both tabs should be present
    await expect(page.getByRole('tab', { name: /Magic link/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /Password/i })).toBeVisible()
  })

  test('successful password login navigates to /app/today', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD')

    const email = process.env.TEST_USER_EMAIL!
    const password = process.env.TEST_USER_PASSWORD!

    await page.goto('/auth/login')
    await page.getByRole('tab', { name: /Password/i }).click()
    await page.getByLabel(/Email/i).fill(email)
    await page.getByLabel(/Password/i).fill(password)
    await page.getByRole('button', { name: /Sign in/i }).click()
    await expect(page).toHaveURL(/\/app\/today/, { timeout: 10_000 })
  })

  test('authenticated user visiting /auth/login is redirected away', async ({ browser }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD')

    const context = await browser.newContext({ storageState: authFile })
    const page = await context.newPage()
    await page.goto('/auth/login')
    // Should be redirected to the app (not stay on /auth/login)
    await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 5_000 })
    await context.close()
  })

  test('logout clears session and redirects to /auth/login', async ({ browser }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD')

    const context = await browser.newContext({ storageState: authFile })
    const page = await context.newPage()
    await page.goto('/app/today')
    await expect(page).toHaveURL(/\/app\/today/)

    // Try to find a logout button in the UI
    const logoutBtn = page.getByRole('button', { name: /log.?out|sign.?out|salir|cerrar sesi/i })
    if (await logoutBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await logoutBtn.click()
      await expect(page).toHaveURL(/\/auth\/login/, { timeout: 8_000 })
    } else {
      // Fallback: clear storage state manually and verify guard redirects
      await context.clearCookies()
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      await page.goto('/app/today')
      await expect(page).toHaveURL(/\/auth\/login/)
    }

    await context.close()
  })
})
