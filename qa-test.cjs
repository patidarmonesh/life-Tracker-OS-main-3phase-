const { chromium } = require('playwright');
const fs = require('fs');

async function runQA() {
  console.log('Starting Autonomous QA Loop...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  
  // Create a clean auth state
  await context.addInitScript(() => {
    localStorage.setItem('lifeos_google_session', JSON.stringify({
      accessToken: 'mock_token',
      tokenExpiresAt: Date.now() + 1000000,
      user: { id: '1', name: 'QA Tester', email: 'qa@lifeos.local' },
      persistent: true
    }));
    localStorage.setItem('lifeos_settings', JSON.stringify({
      profile: { name: 'QA Tester', currency: 'USD', timezone: 'UTC' }
    }));
  });

  const page = await context.newPage();
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console Error: ${msg.text()}`);
    }
  });
  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`);
  });
  page.on('requestfailed', request => {
    errors.push(`Request Failed: ${request.url()} - ${request.failure()?.errorText}`);
  });

  const routes = [
    '/',
    '/finance',
    '/timeflow',
    '/study',
    '/habits',
    '/health',
    '/journal',
    '/ai',
    '/analytics',
    '/settings',
    '/calendar',
    '/rpg',
    '/wisdom',
    '/goals',
    '/decisions',
    '/crm',
    '/brain',
    '/readings',
    '/meditations',
    '/wrapped',
    '/focus',
    '/shared'
  ];

  console.log(`Discovered ${routes.length} routes to test.`);

  for (const route of routes) {
    console.log(`\nTesting route: ${route}`);
    try {
      await page.goto(`http://localhost:5173${route}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000); // Wait for animations/rendering
      
      const title = await page.title();
      console.log(`Page title: ${title}`);
      
      // Capture screenshot for visual QA
      const safeRoute = route === '/' ? 'home' : route.replace(/\//g, '_');
      await page.screenshot({ path: `qa-screenshots/screenshot_${safeRoute}.png`, fullPage: true });
      
      // Test interactivity: find all visible buttons and click a few safely
      // (We won't click everything in this initial script to avoid destructive actions without care)
      const buttons = await page.locator('button:visible').count();
      console.log(`Found ${buttons} visible buttons on ${route}`);
      
    } catch (e) {
      console.error(`Failed testing ${route}:`, e.message);
      errors.push(`Failed testing ${route}: ${e.message}`);
    }
  }

  await browser.close();
  
  if (errors.length > 0) {
    console.log('\n--- QA ERRORS FOUND ---');
    errors.forEach(e => console.log(e));
  } else {
    console.log('\n--- NO RUNTIME ERRORS FOUND ---');
  }
}

runQA().catch(console.error);
