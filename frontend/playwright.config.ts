import { defineConfig, devices } from '@playwright/test';

const liveBackend = process.env.LUMICAL_I04_LIVE_BACKEND;
if (liveBackend && !/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(liveBackend)) {
  throw new Error('I04 live tests require a test-owned loopback backend.');
}
const baseURL = liveBackend ? 'http://127.0.0.1:3211' : 'http://127.0.0.1:3210';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/foundation.spec.ts', '**/admin-templates.spec.ts'],
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: liveBackend ? [
    { name: 'i04-live-chromium', testMatch: '**/template-integration.spec.ts', use: { ...devices['Desktop Chrome'] } },
  ] : [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-visual', testMatch: '**/visual.spec.ts', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: liveBackend ? 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3211' : 'pnpm start --hostname 127.0.0.1 --port 3210',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60000,
    env: liveBackend
      ? { NODE_ENV: 'development', ACCOUNT_COOKIE_NAME: 'lumical_session_dev', BACKEND_URL: liveBackend }
      : { BACKEND_URL: 'http://127.0.0.1:1' },
  },
});
