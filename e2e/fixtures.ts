import { test as base } from '@playwright/test'
import path from 'path'

const authFile = path.join(__dirname, '.auth/user.json')

export const test = base.extend<{ page: import('@playwright/test').Page }>({
  // Authenticated page — loads stored session when credentials are configured
  page: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: process.env.TEST_USER_EMAIL ? authFile : undefined,
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect } from '@playwright/test'
