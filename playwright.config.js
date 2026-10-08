import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/browser', timeout: 90000,
  use: { baseURL: 'http://127.0.0.1:5183', headless: true, viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never' }]], workers: 1,
  webServer: [
    // Dedicated ports prevent a different checkout's running dev server from
    // silently being tested instead of this repository.
    { command: 'npm run dev -- --host 127.0.0.1 --port 5183 --strictPort', env: { API_PORT: '8788' }, url: 'http://127.0.0.1:5183', reuseExistingServer: false, timeout: 60000 },
    { command: 'npm run server', env: { API_PORT: '8788', APP_ORIGIN: 'http://127.0.0.1:5183' }, url: 'http://127.0.0.1:8788/api/session', reuseExistingServer: false, timeout: 60000 },
  ],
})
