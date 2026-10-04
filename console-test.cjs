const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(`Console Error: ${msg.text()} at ${msg.location().url}`);
      }
    });
    page.on('pageerror', err => {
      errors.push(`Page Error: ${err.toString()}`);
    });

    const routes = ['/', '/finance', '/timeflow', '/plan'];
    
    for (const route of routes) {
      const url = `http://localhost:5173${route}`;
      console.log(`Navigating to ${url}`);
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
      } catch (e) {
        console.log(`Timeout or error navigating to ${url}`);
      }
      
      // Wait for rendering
      await new Promise(r => setTimeout(r, 1000));
      
      const buttons = await page.$$('button');
      let clicks = 0;
      for (const btn of buttons) {
        if (clicks >= 4) break;
        try {
          // ensure button is visible
          const isVisible = await btn.evaluate(b => {
             const style = window.getComputedStyle(b);
             return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          });
          if (isVisible) {
             await btn.evaluate(b => b.click());
             await new Promise(r => setTimeout(r, 500));
             clicks++;
          }
        } catch(e) {}
      }
    }

    if (errors.length > 0) {
      console.log('ERRORS_FOUND:');
      errors.forEach(e => console.log(e));
    } else {
      console.log('NO_ERRORS');
    }
  } catch (err) {
    console.error('Script Failed:', err);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
})();
