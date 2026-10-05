import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173/');
  
  await page.evaluate(() => {
    const today = new Date();
    // Use local YYYY-MM-DD
    const dateStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    // Setup dummy plans and entries
    const plans = [
      { id: '1', date: dateStr, name: 'Sleep', start: '02:00', end: '08:00', category: 'Sleep' },
      { id: '2', date: dateStr, name: 'Class', start: '09:00', end: '10:00', category: 'Class' },
      { id: '3', date: dateStr, name: 'ML Padhai', start: '10:00', end: '12:00', category: 'Study' }
    ];
    const entries = [
      { id: 'a', date: dateStr, name: 'Soya', start: '03:00', end: '10:00', category: 'Sleep', planSlotId: '1', planOutcome: 'changed' },
      { id: 'b', date: dateStr, name: 'Class', start: '09:00', end: '10:00', category: 'Class', planSlotId: '2', planOutcome: 'missed', deviationReason: 'Overslept!' },
      { id: 'c', date: dateStr, name: 'Padhai', start: '10:30', end: '12:00', category: 'Study', planSlotId: '3', planOutcome: 'partial' },
      { id: 'd', date: dateStr, name: 'Waste Time', start: '12:00', end: '13:00', category: 'Waste Time' }
    ];
    const timeflowState = { plans, entries, calendarQueue: [] };
    localStorage.setItem('lifeos-module-state-v1:timeflow', JSON.stringify(timeflowState));
    localStorage.setItem('lifeos-module-state-v1:settings', JSON.stringify({ preferences: { timeCategories: [] }, profile: {} }));

    localStorage.setItem('lifeos_google_client_id', 'dummy');
    localStorage.setItem('lifeos_google_session', JSON.stringify({ user: { email: 'dummy@test.com' } }));
    localStorage.setItem('lifeos_token', JSON.stringify({ access_token: 'dummy', expires_at: Date.now() + 1000000 }));
  });

  // Reload to apply localstorage
  await page.reload();
  await page.waitForTimeout(2000); 

  // Click on Time Flow link
  await page.getByText('Time Flow').click();
  await page.waitForTimeout(2000); 

  // Take screenshot
  await page.screenshot({ path: 'C:/Users/mayan/.gemini/antigravity/brain/9436d56a-ba9a-4d0a-958d-ad3d7ca621d9/scratch/screenshot-time3.png', fullPage: true });

  await browser.close();
})();
