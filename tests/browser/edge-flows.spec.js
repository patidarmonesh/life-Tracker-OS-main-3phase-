import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/google-auth?action=config', route => route.fulfill({ json: { configured: false } }))
  await page.route('https://www.googleapis.com/**', route => route.fulfill({ status: 401, json: {} }))
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('lifeos_google_session', JSON.stringify({ user: { id: 'test-user' }, tokenExpiresAt: 1 }))
    localStorage.setItem('lifeos_google_client_id', 'test-client')
    localStorage.setItem('lifeos_gemini_api_key', 'fake-key')
    localStorage.setItem('lifeos-module-state-v1:settings', JSON.stringify({ geminiKey: 'fake-key', profile: { name: 'Test', timezone: 'Asia/Kolkata' } }))
    localStorage.setItem('lifeos-module-state-v1:timeflow', JSON.stringify({ entries: [], plans: [] }))
  })
})

const getTimeflowState = async (page) => {
  return await page.evaluate(() => {
    const raw = localStorage.getItem('lifeos-module-state-v1:timeflow')
    return raw ? JSON.parse(raw) : {}
  })
}

test('move to tomorrow creates a fresh baseline on empty destination', async ({ page }) => {
  await page.goto('/timeflow')
  await page.locator('input[type="date"]').first().fill('2026-01-05')
  await page.getByRole('button', { name: 'Plan my day', exact: true }).click()
  const plan = page.getByRole('dialog')
  await plan.getByLabel('Activity 1', { exact: true }).fill('Study')
  await plan.getByLabel('Category 1', { exact: true }).selectOption('Study')
  await plan.getByLabel('Automatically sync to Google Calendar').uncheck()
  await plan.getByRole('button', { name: 'Save tentative plan' }).click()
  
  await expect(plan).toBeHidden()
  
  await page.getByRole('button', { name: 'Check in', exact: true }).click()
  const check = page.getByRole('dialog', { name: 'Plan check-in', exact: true })
  await check.getByRole('combobox').first().selectOption('missed')
  await check.getByRole('button', { name: 'Save check-in', exact: true }).click()
  
  await expect(page.getByRole('button', { name: 'Move to tomorrow' })).toBeVisible()
  await page.getByRole('button', { name: 'Move to tomorrow' }).click()
  
  await expect(page.getByText(/Moved "Study" to/)).toBeVisible()
  await page.waitForTimeout(500)
  
  const tf = await getTimeflowState(page)
  const baselines = tf.planBaselines || []
  const tmrwBaseline = baselines.find(b => b.date === '2026-01-06')
  expect(tmrwBaseline).toBeDefined()
  expect(tmrwBaseline.origin).toBe('first-save')
  expect(tmrwBaseline.slots.length).toBe(1)
})

test('reschedule button in tray does not persist decision until save', async ({ page }) => {
  await page.goto('/timeflow')
  await page.locator('input[type="date"]').first().fill('2026-01-05')
  await page.getByRole('button', { name: 'Plan my day', exact: true }).click()
  const plan = page.getByRole('dialog')
  await plan.getByLabel('Activity 1', { exact: true }).fill('Study')
  await plan.getByLabel('Category 1', { exact: true }).selectOption('Study')
  await plan.getByLabel('Automatically sync to Google Calendar').uncheck()
  await plan.getByRole('button', { name: 'Save tentative plan' }).click()
  
  await expect(plan).toBeHidden()
  
  await page.getByRole('button', { name: 'Check in', exact: true }).click()
  const check = page.getByRole('dialog', { name: 'Plan check-in', exact: true })
  await check.getByRole('combobox').first().selectOption('missed')
  await check.getByRole('button', { name: 'Save check-in', exact: true }).click()
  
  await expect(page.getByRole('button', { name: 'Reschedule today' })).toBeVisible()
  await page.getByRole('button', { name: 'Reschedule today' }).click()
  
  // Wait for dialog
  const plan2 = page.getByRole('dialog')
  await expect(plan2).toBeVisible()
  
  await page.keyboard.press('Escape')
  await expect(plan2).toBeHidden()
  await page.waitForTimeout(500)
  
  let tf = await getTimeflowState(page)
  expect(tf.displacedDecisions || []).toEqual([])
  expect(tf.pendingRescheduleSlotId || null).toBeNull()
  
  await page.getByRole('button', { name: 'Reschedule today' }).click()
  await expect(plan2).toBeVisible()
  
  // Save unchanged -> expect error
  await plan2.getByRole('button', { name: 'Save tentative plan' }).click()
  await expect(page.getByText('Change this activity’s start or end time before saving.')).toBeVisible()
  
  // Change target activity's time
  await plan2.getByLabel('Start 1', { exact: true }).fill('11:00')
  await plan2.getByLabel('End 1', { exact: true }).fill('12:00')

  await plan2.getByRole('button', { name: 'Save tentative plan' }).click()
  
  await expect(plan2).toBeHidden()
  await page.waitForTimeout(500)

  tf = await getTimeflowState(page)
  expect(tf.displacedDecisions).toBeDefined()
  expect(tf.displacedDecisions.some(d => d.status === 'rescheduled')).toBeTruthy()
})

test('missed-only diary import is accepted without overlap checks', async ({ page }) => {
  await page.route('https://generativelanguage.googleapis.com/**', route => {
    route.fulfill({
      json: {
        candidates: [{
           content: {
             parts: [{
               text: '\`\`\`json\\n{"actuals": [{"planSlotId": "dummy", "start": "10:00", "end": "11:00", "planOutcome": "missed", "category": "Study", "isWaste": false, "name": "Study"}]}\\n\`\`\`'
             }]
           }
        }]
      }
    })
  })

  await page.goto('/timeflow')
  await page.locator('input[type="date"]').first().fill('2026-01-05')
  await page.getByRole('button', { name: 'Plan my day', exact: true }).click()
  const plan = page.getByRole('dialog')
  await plan.getByLabel('Activity 1', { exact: true }).fill('Study')
  await plan.getByLabel('Category 1', { exact: true }).selectOption('Study')
  await plan.getByLabel('Automatically sync to Google Calendar').uncheck()
  await plan.getByRole('button', { name: 'Save tentative plan' }).click()
  
  await expect(plan).toBeHidden()
  await page.waitForTimeout(500) // Ensure localStorage has synced the new plan

  const tf1 = await getTimeflowState(page)
  const slot = tf1.plans[0]
  
  const response = {
    actuals: [{
      planSlotId: slot.id,
      start: slot.start,
      end: slot.end,
      planOutcome: 'missed',
      category: slot.category,
      name: slot.name,
      isWaste: false,
    }],
  }

  await page.route('https://generativelanguage.googleapis.com/**', route => {
    route.fulfill({
      json: {
        candidates: [{
           content: {
             parts: [{
               text: '\`\`\`json\n' + JSON.stringify(response) + '\n\`\`\`'
             }]
           }
        }]
      }
    })
  })

  await page.getByRole('button', { name: 'Log actuals' }).click()
  const actualsDialog = page.getByRole('dialog', { name: 'Log Actuals via Diary Photo' })
  
  await actualsDialog.locator('textarea').first().fill('I missed my study session')
  await actualsDialog.getByRole('button', { name: 'Log Actuals' }).click()
  
  await expect(actualsDialog.getByText('Preview Imports')).toBeVisible()
  await actualsDialog.getByRole('button', { name: 'Confirm & Save Actuals' }).click()
  
  await expect(page.getByText('Actuals saved!')).toBeVisible()
  await page.waitForTimeout(500)

  const tf = await getTimeflowState(page)
  const entries = tf.entries || []
  const missedEntry = entries.find(e => e.planOutcome === 'missed')
  expect(missedEntry).toBeDefined()
  
  await expect(page.getByText('60m changed')).toBeVisible()
  await expect(page.getByText('0m logged')).toBeVisible()
})
