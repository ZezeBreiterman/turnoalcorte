import { test as setup, expect } from '@playwright/test'
import path from 'path'

export const authFile = path.join(__dirname, '.auth/user.json')

setup('authenticate', async ({ page }) => {
  // Skip if no test credentials provided (CI without secrets)
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD
  if (!email || !password) {
    console.warn('TEST_USER_EMAIL / TEST_USER_PASSWORD not set — skipping auth setup')
    return
  }

  await page.goto('/auth/login')
  // Switch to password tab
  await page.getByRole('tab', { name: /Password/i }).click()
  await page.getByLabel(/Email/i).fill(email)
  await page.getByLabel(/Password/i).fill(password)
  await page.getByRole('button', { name: /Sign in/i }).click()
  await expect(page).toHaveURL(/\/app\/today/)
  await page.context().storageState({ path: authFile })
})
