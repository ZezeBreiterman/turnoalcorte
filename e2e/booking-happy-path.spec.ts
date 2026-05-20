import { test, expect } from '@playwright/test'

// TEST-3: Full anonymous booking happy path.
// Walks: service → pick (barber+date+slot) → info (name, phone) → done (ticket).
// Assumes Supabase demo DB has at least one active service, one active barber,
// and the barber's schedule covers at least one upcoming day in the next 14.

test.describe('booking happy path', () => {
  test('user can book an appointment end-to-end', async ({ page }) => {
    await page.goto('/book')

    // ── Step 1: Service ────────────────────────────────────────────────────
    // Service cards are <button> elements rendered inside StepService.
    // Click the first one. Any button with a price-looking text would do,
    // but the first .group-style card is the safest.
    const serviceButtons = page.locator('main button, [role="main"] button').filter({
      has: page.locator('text=/\\$|€|ARS|\\d+\\s*min/i'),
    })
    // Fallback: the first card-shaped button in the step content.
    const firstService = serviceButtons.first()
    await firstService.waitFor({ state: 'visible', timeout: 15_000 })
    await firstService.click()

    // ── Continue to pick step ──────────────────────────────────────────────
    await page.getByRole('button', { name: /continuar|continue/i }).click()

    // ── Step 2: Pick ───────────────────────────────────────────────────────
    // Wait for time slot buttons (HH:MM format). Today is auto-selected.
    // If no slots are available today, click the next day in the strip that
    // is not disabled and try again.
    const slotRegex = /^\d{1,2}:\d{2}$/
    const slot = page.getByRole('button', { name: slotRegex }).first()

    // Give the slot query time to resolve.
    await page.waitForTimeout(1500)

    let slotVisible = await slot.isVisible().catch(() => false)
    if (!slotVisible) {
      // Try advancing through the 14-day strip looking for a day with slots.
      const dayButtons = page.getByRole('button', { name: /,/ }) // aria-label contains commas
      const count = await dayButtons.count()
      for (let i = 1; i < Math.min(count, 14); i++) {
        const d = dayButtons.nth(i)
        if (await d.isDisabled().catch(() => true)) continue
        await d.click()
        await page.waitForTimeout(1200)
        if (await slot.isVisible().catch(() => false)) {
          slotVisible = true
          break
        }
      }
    }
    expect(slotVisible, 'expected at least one bookable slot in the next 14 days').toBe(true)

    await slot.click()

    // Wait briefly for hold_slot RPC to resolve before continuing.
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: /continuar|continue/i }).click()

    // ── Step 3: Info ───────────────────────────────────────────────────────
    await page.getByLabel(/nombre|name/i).first().fill('Test User E2E')
    await page.getByLabel(/teléfono|telefono|phone/i).first().fill('+5491112345678')
    // email left blank (optional)

    await page.getByRole('button', { name: /confirmar|confirm/i }).click()

    // ── Step 4: Done ───────────────────────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: /confirmado|confirmed/i })
    ).toBeVisible({ timeout: 15_000 })

    // Booking code is 6 uppercase alphanumerics. The element uses tracking,
    // so match against the rendered text body.
    await expect(page.locator('body')).toContainText(/[A-Z0-9]{6}/)
  })
})
