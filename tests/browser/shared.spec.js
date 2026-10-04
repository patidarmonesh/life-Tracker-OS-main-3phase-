import { test, expect } from '@playwright/test'

const today = new Date().toISOString().slice(0, 10)
const timeflow = {
  entries: [
    { id: 'e1', date: today, start: '07:00', end: '08:00', durationMinutes: 60, name: 'Gym', category: 'Exercise', productivityScore: 4, notes: 'Leg day', tags: ['fitness'], updatedAt: '2026-01-01T00:00:00Z' },
    { id: 'e2', date: today, start: '09:00', end: '12:00', durationMinutes: 180, name: 'Study maths', category: 'Study', productivityScore: 5, updatedAt: '2026-01-01T00:00:00Z' },
    { id: 'e3', date: today, start: '13:00', end: '14:00', durationMinutes: 60, name: 'Instagram', category: 'Social Media', isWaste: true, productivityScore: 1, updatedAt: '2026-01-01T00:00:00Z' },
  ],
  plans: [],
}

test('shared link shows the real app pages read-only', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/api/drive-proxy**', route => route.fulfill({ json: timeflow }))
  await page.goto('/shared?ids=file1&modules=timeflow&name=Ravish')

  await expect(page.getByText('Read-only').first()).toBeVisible()
  await expect(page.getByText('Your day at a glance')).toBeVisible()
  await expect(page.getByText('Actual timeline')).toBeVisible()
  // Edit affordances are hidden
  await expect(page.getByRole('button', { name: /Add Entry/ })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Plan my day', exact: true })).toBeHidden()

  // Timeline entry expands on tap but offers no edit/delete
  await page.locator('.tl-entry').filter({ hasText: 'Gym' }).getByRole('button').first().click()
  await expect(page.getByText('Leg day')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit entry' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete time entry' })).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('navigation', { name: 'Shared modules' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/shared-mobile.png', fullPage: true })
  expect(errors).toEqual([])
})
