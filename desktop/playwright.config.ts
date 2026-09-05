import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against the Vite dev server rather than the packaged binary: the
 * renderer is the whole frontend, and driving it in Chromium is both faster and
 * reproducible on CI, where no WebKitGTK/WebView2 runtime is installed.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
  },
  // Uses the system Chrome rather than a downloaded build: one less 150 MB
  // artifact for a suite that only drives a web page.
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
