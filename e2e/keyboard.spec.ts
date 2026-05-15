import { test, expect } from './fixtures'

test.describe('Keyboard accessibility', () => {
  test.beforeEach(() => {
    test.skip(!process.env.TEST_USER_EMAIL, 'No test credentials — set TEST_USER_EMAIL and TEST_USER_PASSWORD')
  })

  test('Ctrl+K opens command palette with a visible input', async ({ page }) => {
    await page.goto('/app/today')
    // Press Ctrl+K to open the command palette
    await page.keyboard.press('Control+k')

    // The command palette should show a search input
    const paletteInput = page.getByRole('combobox').or(page.getByRole('searchbox')).or(
      page.locator('[cmdk-input], [class*="command"] input, [placeholder*="Search"], [placeholder*="Buscar"]')
    ).first()
    await expect(paletteInput).toBeVisible({ timeout: 5_000 })
  })

  test('typing "Today" in command palette shows a matching command item', async ({ page }) => {
    await page.goto('/app/today')
    await page.keyboard.press('Control+k')

    const paletteInput = page.getByRole('combobox').or(page.getByRole('searchbox')).or(
      page.locator('[cmdk-input], [class*="command"] input')
    ).first()
    await expect(paletteInput).toBeVisible({ timeout: 5_000 })
    await paletteInput.fill('Today')

    // A command item mentioning "Today" should appear
    const item = page.getByRole('option', { name: /Today|Hoy/i }).or(
      page.locator('[cmdk-item]').filter({ hasText: /Today|Hoy/i })
    ).first()
    await expect(item).toBeVisible({ timeout: 5_000 })
  })

  test('pressing Enter on a command item navigates to /app/today', async ({ page }) => {
    await page.goto('/app/calendar')
    await page.keyboard.press('Control+k')

    const paletteInput = page.getByRole('combobox').or(page.getByRole('searchbox')).or(
      page.locator('[cmdk-input], [class*="command"] input')
    ).first()
    await expect(paletteInput).toBeVisible({ timeout: 5_000 })
    await paletteInput.fill('Today')

    // Wait for item and select it
    const item = page.getByRole('option', { name: /Today|Hoy/i }).or(
      page.locator('[cmdk-item]').filter({ hasText: /Today|Hoy/i })
    ).first()
    await expect(item).toBeVisible({ timeout: 5_000 })
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/app\/today/, { timeout: 8_000 })
  })

  test('Escape closes command palette', async ({ page }) => {
    await page.goto('/app/today')
    await page.keyboard.press('Control+k')

    const paletteInput = page.getByRole('combobox').or(page.getByRole('searchbox')).or(
      page.locator('[cmdk-input], [class*="command"] input')
    ).first()
    await expect(paletteInput).toBeVisible({ timeout: 5_000 })

    await page.keyboard.press('Escape')

    // Palette should be hidden after Escape
    await expect(paletteInput).not.toBeVisible({ timeout: 3_000 })
  })

  test('after palette closes, focus returns to the page (not document.body)', async ({ page }) => {
    await page.goto('/app/today')
    await page.keyboard.press('Control+k')

    const paletteInput = page.getByRole('combobox').or(page.getByRole('searchbox')).or(
      page.locator('[cmdk-input], [class*="command"] input')
    ).first()
    await expect(paletteInput).toBeVisible({ timeout: 5_000 })

    await page.keyboard.press('Escape')
    await expect(paletteInput).not.toBeVisible({ timeout: 3_000 })

    // The focused element should not be document.body (indicates proper focus management)
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase() ?? 'body')
    expect(focusedTag).not.toBe('body')
  })

  test('Tab through Today page header buttons — all are keyboard-reachable', async ({ page }) => {
    await page.goto('/app/today')

    // Gather all interactive elements in the header area
    const headerButtons = page.locator('header button, nav button, [role="banner"] button')
    const count = await headerButtons.count()

    // Each button should have a tabIndex that is not -1
    for (let i = 0; i < count; i++) {
      const btn = headerButtons.nth(i)
      const tabIndex = await btn.getAttribute('tabindex')
      // tabindex of null (default) or >= 0 means it's reachable; only -1 means excluded
      expect(tabIndex).not.toBe('-1')
    }

    // Also verify at least one header button exists
    expect(count).toBeGreaterThan(0)
  })
})
