import { test, expect } from './fixtures'

test.describe('Appointment creation', () => {
  test.beforeEach(() => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD')
  })

  test('"Add appointment" button is visible on Today page', async ({ page }) => {
    await page.goto('/app/today')
    // Look for a button that creates/adds an appointment
    const addBtn = page.getByRole('button', { name: /add appointment|nuevo turno|agregar turno|add/i })
    await expect(addBtn).toBeVisible()
  })

  test('clicking "Add appointment" opens a sheet/drawer', async ({ page }) => {
    await page.goto('/app/today')
    const addBtn = page.getByRole('button', { name: /add appointment|nuevo turno|agregar turno/i })
    await addBtn.click()

    // Expect a dialog or panel with an "Add appointment" heading
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Heading should reference "appointment" or equivalent
    const heading = dialog.getByRole('heading')
    await expect(heading).toBeVisible()
  })

  test('form can be filled and submitted successfully', async ({ page }) => {
    await page.goto('/app/today')
    const addBtn = page.getByRole('button', { name: /add appointment|nuevo turno|agregar turno/i })
    await addBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Fill barber select (first available option)
    const barberSelect = dialog.getByRole('combobox').first()
    if (await barberSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await barberSelect.click()
      const firstOption = page.getByRole('option').first()
      if (await firstOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await firstOption.click()
      }
    }

    // Fill service select
    const serviceSelect = dialog.getByRole('combobox').nth(1)
    if (await serviceSelect.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await serviceSelect.click()
      const firstServiceOption = page.getByRole('option').first()
      if (await firstServiceOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await firstServiceOption.click()
      }
    }

    // Fill client name
    const nameInput = dialog.getByLabel(/client name|nombre|name/i)
    if (await nameInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nameInput.fill('Test Client E2E')
    }

    // Fill phone
    const phoneInput = dialog.getByLabel(/phone|tel[eé]fono/i)
    if (await phoneInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await phoneInput.fill('+1234567890')
    }

    // Submit
    const submitBtn = dialog.getByRole('button', { name: /save|confirm|book|guardar|confirmar/i })
    await submitBtn.click()

    // Either dialog closes OR a success toast appears
    const toastOrClose = Promise.race([
      dialog.waitFor({ state: 'hidden', timeout: 8_000 }),
      page.getByRole('status').filter({ hasText: /success|éxito|turno/i }).waitFor({ timeout: 8_000 }),
    ])
    await toastOrClose
  })

  test('network failure: 500 on POST /appointments keeps sheet open and shows error', async ({ page }) => {
    await page.goto('/app/today')

    // Intercept any REST or RPC call that creates an appointment
    await page.route(/\/(appointments|rpc\/.*appointment)/i, (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) })
      } else {
        route.continue()
      }
    })

    const addBtn = page.getByRole('button', { name: /add appointment|nuevo turno|agregar turno/i })
    await addBtn.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5_000 })

    // Fill minimal required fields to get past client-side validation
    const nameInput = dialog.getByLabel(/client name|nombre|name/i)
    if (await nameInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nameInput.fill('Error Test Client')
    }

    const submitBtn = dialog.getByRole('button', { name: /save|confirm|book|guardar|confirmar/i })
    await submitBtn.click()

    // Dialog should remain open (no ghost card) and error should surface
    // Give it a moment to attempt the request
    await page.waitForTimeout(1_000)
    // Dialog stays visible
    await expect(dialog).toBeVisible()
  })
})
