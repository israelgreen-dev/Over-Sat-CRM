import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  fullyParallel: false,
  reporter: 'list',

  use: {
    baseURL: 'http://localhost:3000',
    // Capture a screenshot on every test failure for easier debugging.
    screenshot: 'only-on-failure',
    // Record a trace on the first retry so failures are fully replayable.
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start the Next.js dev server automatically before the suite runs.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
