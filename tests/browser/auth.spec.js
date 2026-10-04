import { test, expect } from '@playwright/test'

async function signedOut(page) {
  await page.route('**/api/session', route => route.fulfill({ json: { user: null, capabilities: { auth: true }, integration: { state: 'disconnected' } } }))
}

test('Google sign-in navigates to the authorization URL returned by the server', async ({ page }) => {
  await signedOut(page)
  await page.route('**/api/oauth/start', async route => {
    expect(route.request().postDataJSON()).toEqual({ purpose: 'login' })
    await route.fulfill({ json: { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=fixture' } })
  })
  await page.route('https://accounts.google.com/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Mock Google authorization</h1>' }))
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Sign in with Google', exact: true }).click()
  await expect(page).toHaveURL('https://accounts.google.com/o/oauth2/v2/auth?state=fixture')
})

test('database configuration failure stays on LifeOS with a useful error and allows retry', async ({ page }) => {
  await signedOut(page)
  const error = 'SUPABASE_URL must be your project API URL, not the Supabase dashboard URL.'
  let attempts = 0
  await page.route('**/api/oauth/start', route => { attempts++; return route.fulfill({ status: 503, json: { error, code: 'storage_url_invalid' } }) })
  await page.goto('/auth')
  const button = page.getByRole('button', { name: 'Sign in with Google', exact: true })
  await button.click()
  await expect(page.getByRole('alert')).toHaveText(error)
  await expect(button).toBeEnabled()
  await button.click()
  await expect.poll(() => attempts).toBe(2)
  await expect(page).toHaveURL(/\/auth$/)
})
