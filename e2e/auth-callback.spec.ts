import { test, expect } from '@playwright/test'

// TEST-6: /auth/callback handler.
//
// Real magic-link callbacks need a token delivered by email, which we can't
// produce in a hermetic e2e environment. So this test only verifies the
// fallback path: hitting /auth/callback with no Supabase session in storage
// should not throw, should render briefly, and should eventually settle on
// either /auth/login (no session) or /app/today (already-authenticated case).
//
// A fuller test would inject a fake Supabase session via page.evaluate() and
// the anon key, but that requires shipping the anon key into the test env.

test.describe('auth callback', () => {
  test('renders the callback page and settles on login or today', async ({ page }) => {
    // Capture any uncaught errors so a thrown exception fails the test.
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/auth/callback')

    // The page should mount without throwing. Give the auth state listener a
    // moment to fire (SIGNED_OUT timeout, etc.).
    await page.waitForTimeout(2_000)

    // After settling, the URL should be one of the two acceptable terminals.
    // We poll for up to 10 s rather than asserting immediately, since the
    // callback may take a few ticks to redirect.
    await expect
      .poll(() => page.url(), { timeout: 10_000, intervals: [250, 500, 1000] })
      .toMatch(/\/(auth\/login|app\/today)\b/)

    expect(errors, `unexpected page errors: ${errors.join(' | ')}`).toEqual([])
  })
})
