import { test, expect } from './fixtures'

test.describe('Calendar drag-and-drop rescheduling', () => {
  test.beforeEach(() => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD')
  })

  test('calendar page loads with grid visible', async ({ page }) => {
    await page.goto('/app/calendar')
    // The calendar grid should be present — look for a time-grid or event container
    const grid = page.locator('[role="grid"], [class*="calendar"], [class*="time-grid"], [class*="scheduler"]').first()
    await expect(grid).toBeVisible({ timeout: 8_000 })
  })

  test('skip gracefully if no appointments exist for today', async ({ page }) => {
    await page.goto('/app/calendar')

    // Wait for the calendar to settle
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { /* best-effort */ })

    const appointmentBlock = page.locator(
      '[class*="appointment"], [class*="event"], [draggable="true"], [data-appointment]'
    ).first()

    const hasAppointment = await appointmentBlock.isVisible({ timeout: 3_000 }).catch(() => false)

    if (!hasAppointment) {
      test.skip(true, 'No appointments found for today — skipping DnD test')
    }

    // If we're still running, drag the first appointment block ~65px down (≈1 hour)
    const box = await appointmentBlock.boundingBox()
    if (!box) {
      test.skip(true, 'Could not get bounding box for appointment block')
      return
    }

    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    const targetY = startY + 65

    const mouse = page.mouse

    // Low-level mouse events for reliable DnD in Playwright
    await mouse.move(startX, startY)
    await mouse.down()

    // Move in small increments to trigger drag threshold detection
    const steps = 10
    const deltaY = (targetY - startY) / steps
    for (let i = 1; i <= steps; i++) {
      await mouse.move(startX, startY + deltaY * i, { steps: 2 })
    }

    await mouse.up()

    // Verify block's visual position changed
    const newBox = await appointmentBlock.boundingBox()
    if (newBox) {
      expect(newBox.y).toBeGreaterThan(box.y + 20)
    }
  })

  test('DnD success: toast with "reprogramado" appears after move', async ({ page }) => {
    await page.goto('/app/calendar')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { /* best-effort */ })

    const appointmentBlock = page.locator(
      '[class*="appointment"], [class*="event"], [draggable="true"], [data-appointment]'
    ).first()

    const hasAppointment = await appointmentBlock.isVisible({ timeout: 3_000 }).catch(() => false)
    test.skip(!hasAppointment, 'No appointments found for today — skipping DnD success test')
    if (!hasAppointment) return

    const box = await appointmentBlock.boundingBox()
    if (!box) {
      test.skip(true, 'Could not get bounding box for appointment block')
      return
    }

    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    const targetY = startY + 65
    const mouse = page.mouse

    await mouse.move(startX, startY)
    await mouse.down()

    const steps = 10
    const deltaY = (targetY - startY) / steps
    for (let i = 1; i <= steps; i++) {
      await mouse.move(startX, startY + deltaY * i, { steps: 2 })
    }

    await mouse.up()

    // Look for a success toast containing "reprogramado"
    const toast = page.getByText(/reprogramado/i)
    await expect(toast).toBeVisible({ timeout: 8_000 })
  })

  test('DnD network failure: mutation 500 causes rollback and error toast', async ({ page }) => {
    await page.goto('/app/calendar')
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => { /* best-effort */ })

    const appointmentBlock = page.locator(
      '[class*="appointment"], [class*="event"], [draggable="true"], [data-appointment]'
    ).first()

    const hasAppointment = await appointmentBlock.isVisible({ timeout: 3_000 }).catch(() => false)
    test.skip(!hasAppointment, 'No appointments found for today — skipping DnD failure test')
    if (!hasAppointment) return

    // Intercept the PATCH/PUT that rescheduled the appointment
    await page.route(/\/(appointments|rpc\/.*reschedule)/i, (route) => {
      const method = route.request().method()
      if (method === 'PATCH' || method === 'PUT' || method === 'POST') {
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) })
      } else {
        route.continue()
      }
    })

    const box = await appointmentBlock.boundingBox()
    if (!box) {
      test.skip(true, 'Could not get bounding box for appointment block')
      return
    }

    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2
    const targetY = startY + 65
    const mouse = page.mouse

    await mouse.move(startX, startY)
    await mouse.down()

    const steps = 10
    const deltaY = (targetY - startY) / steps
    for (let i = 1; i <= steps; i++) {
      await mouse.move(startX, startY + deltaY * i, { steps: 2 })
    }

    await mouse.up()

    // Wait for server response
    await page.waitForTimeout(2_000)

    // Block should return to roughly original position (rollback)
    const newBox = await appointmentBlock.boundingBox()
    if (newBox) {
      expect(newBox.y).toBeCloseTo(box.y, -1) // within ~10px
    }

    // Error toast should appear
    const errorToast = page.getByText(/error|fail|falló|problema/i)
    await expect(errorToast).toBeVisible({ timeout: 5_000 })
  })
})
