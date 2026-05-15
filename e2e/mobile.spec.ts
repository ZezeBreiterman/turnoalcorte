/**
 * Mobile viewport smoke tests.
 * These tests run under the `mobile` Playwright project (iPhone 13 viewport).
 * They do NOT require auth credentials — /book is public and layout checks
 * are visual only.
 */
import { test, expect } from './fixtures'

test.describe('Mobile viewport smoke tests', () => {
  test('Today page renders without horizontal overflow', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD')

    await page.goto('/app/today')

    const hasOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth
    })
    expect(hasOverflow).toBe(false)
  })

  test('sidebar is not visible at mobile breakpoint', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD')

    await page.goto('/app/today')

    // Sidebar is typically rendered as nav or aside; on mobile it should be hidden or off-screen
    const sidebar = page.locator(
      'aside, nav[class*="sidebar"], [class*="sidebar"], [data-sidebar]'
    ).first()

    if (await sidebar.isVisible({ timeout: 3_000 }).catch(() => false)) {
      // If it's "visible" in DOM, verify it's actually off-screen
      const box = await sidebar.boundingBox()
      const viewportSize = page.viewportSize()
      if (box && viewportSize) {
        const isOffScreen = box.x + box.width <= 0 || box.x >= viewportSize.width
        expect(isOffScreen).toBe(true)
      }
    }
    // If sidebar is not in the DOM / display:none — test passes automatically
  })

  test('"Add appointment" button is tap-reachable (height >= 40px)', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD')

    await page.goto('/app/today')

    const addBtn = page.getByRole('button', { name: /add appointment|nuevo turno|agregar/i })
    await expect(addBtn).toBeVisible({ timeout: 5_000 })

    const box = await addBtn.boundingBox()
    expect(box).not.toBeNull()
    // Touch target should be at least 40px tall per accessibility guidelines
    expect(box!.height).toBeGreaterThanOrEqual(40)
  })

  test('/book renders correctly at mobile width: service list visible, CTA button present', async ({ page }) => {
    await page.goto('/book')

    // Wait for the page to load
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { /* best-effort */ })

    // Service list should be visible (could be a list or grid of service items)
    const serviceList = page.locator(
      '[class*="service"], [data-service], ul li, [role="list"] [role="listitem"]'
    ).first()
    await expect(serviceList).toBeVisible({ timeout: 8_000 })

    // A CTA button (Book, Reserve, Confirm, etc.) should be present
    const ctaButton = page.getByRole('button', {
      name: /book|reserve|confirm|reservar|confirmar|next|siguiente|seleccionar/i,
    })
    await expect(ctaButton.first()).toBeVisible({ timeout: 5_000 })
  })

  test('no elements overflow the viewport horizontally on /book', async ({ page }) => {
    await page.goto('/book')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { /* best-effort */ })

    const hasOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth
    })
    expect(hasOverflow).toBe(false)
  })
})
