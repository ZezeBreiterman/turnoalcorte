import { test, expect, type Page } from '@playwright/test'

// TEST-4: Concurrent booking conflict.
// Two browser contexts try to book the same slot simultaneously. Exactly one
// must succeed (lands on the done step); the other must be sent back to the
// pick step or shown a "just got taken" toast.

async function advanceToConfirm(page: Page) {
  await page.goto('/book')

  // Pick the first service.
  const firstService = page
    .locator('main button, [role="main"] button')
    .filter({ has: page.locator('text=/\\$|€|ARS|\\d+\\s*min/i') })
    .first()
  await firstService.waitFor({ state: 'visible', timeout: 15_000 })
  await firstService.click()

  await page.getByRole('button', { name: /continuar|continue/i }).click()

  // Pick the first available slot (today or scan forward).
  const slotRegex = /^\d{1,2}:\d{2}$/
  const slot = page.getByRole('button', { name: slotRegex }).first()

  await page.waitForTimeout(1500)
  let slotVisible = await slot.isVisible().catch(() => false)
  if (!slotVisible) {
    const dayButtons = page.getByRole('button', { name: /,/ })
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
  expect(slotVisible, 'expected at least one slot for conflict test').toBe(true)

  await slot.click()
  await page.waitForTimeout(800)
  await page.getByRole('button', { name: /continuar|continue/i }).click()

  await page.getByLabel(/nombre|name/i).first().fill('Conflict User')
  await page.getByLabel(/teléfono|telefono|phone/i).first().fill('+5491100000000')
}

async function isOnDoneStep(page: Page): Promise<boolean> {
  const heading = page.getByRole('heading', { name: /confirmado|confirmed/i })
  try {
    await heading.waitFor({ state: 'visible', timeout: 8_000 })
    return true
  } catch {
    return false
  }
}

test.describe('booking conflict', () => {
  test('only one of two concurrent bookings for the same slot succeeds', async ({ browser }) => {
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()

    try {
      // Walk both up to the confirm button in parallel.
      await Promise.all([advanceToConfirm(pageA), advanceToConfirm(pageB)])

      // Fire the confirms as close to simultaneously as possible.
      const confirmA = pageA.getByRole('button', { name: /confirmar|confirm/i })
      const confirmB = pageB.getByRole('button', { name: /confirmar|confirm/i })
      await Promise.all([confirmA.click(), confirmB.click()])

      const [aDone, bDone] = await Promise.all([isOnDoneStep(pageA), isOnDoneStep(pageB)])
      const successCount = [aDone, bDone].filter(Boolean).length

      // Note: if the two browsers picked different slots (e.g. multiple barbers
      // share the same time), both may succeed. In that case we still consider
      // the slot-hold mechanic verified — but the strict conflict assertion
      // requires successCount === 1. Soft-assert with a clear message.
      expect(
        successCount,
        `expected exactly one booking to succeed when racing for the same slot, got ${successCount}`,
      ).toBe(1)

      // The loser should either be back on the pick step or show a toast.
      const loser = aDone ? pageB : pageA
      const toast = loser.locator('body').getByText(/se acaba de ocupar|just got taken|ocupar|taken/i).first()
      const onPick = await loser.getByRole('button', { name: /^\d{1,2}:\d{2}$/ }).first().isVisible().catch(() => false)
      const hasToast = await toast.isVisible().catch(() => false)
      expect(onPick || hasToast, 'loser should be on pick step or see a conflict toast').toBe(true)
    } finally {
      await ctxA.close()
      await ctxB.close()
    }
  })
})
