import { expect, test, type Page } from '@playwright/test'

/**
 * Persistent login.
 *
 * Access tokens last 15 minutes, so "still signed in tomorrow" depends
 * entirely on the refresh token surviving a restart and being exchanged before
 * anything else runs. These drive that from the outside: seed the stored
 * credential, stub the exchange, and assert on which screen the app lands.
 */
const API = 'https://messanger.cognilabs.org'

const ME = {
  id: 1,
  username: 'ann',
  email: 'ann@example.com',
  full_name: 'Ann Karimova',
  avatar_url: null,
  role_id: null,
  department_id: null,
  title: 'Engineer',
  about: null,
  timezone: 'UTC',
  phone: null,
  handle: null,
  office_location: null,
  manager_id: null,
  last_seen_at: null,
  status: 'available',
  created_at: '2026-03-01T00:00:00Z',
}

const SESSIONS = [
  {
    id: 'session-current',
    device_name: 'Qora Qarga Desktop (Linux)',
    created_at: '2026-09-05T10:00:00Z',
    last_used_at: '2026-09-05T12:00:00Z',
    expires_at: '2027-03-04T12:00:00Z',
    is_current: true,
  },
  {
    id: 'session-phone',
    device_name: 'iPhone 16',
    created_at: '2026-08-01T10:00:00Z',
    last_used_at: '2026-09-01T09:00:00Z',
    expires_at: '2027-02-01T09:00:00Z',
    is_current: false,
  },
]

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

/** The browser build keeps the refresh token here; the desktop build does not. */
const seedStoredSession = (page: Page) =>
  page.addInitScript(() => {
    localStorage.setItem('qq.secret.refresh-token', 'stored-refresh-token')
    localStorage.setItem(
      'qq.auth',
      JSON.stringify({ state: { user: null, deviceId: 'device-test' }, version: 0 }),
    )
  })

const stubSignedInApi = async (page: Page) => {
  await page.route(`${API}/users/me`, (route) => route.fulfill(json(ME)))
  await page.route(`${API}/users?**`, (route) => route.fulfill(json([])))
  await page.route(`${API}/conversations?**`, (route) => route.fulfill(json([])))
  await page.route(`${API}/presence/**`, (route) => route.fulfill(json([])))
  await page.route(`${API}/auth/sessions`, (route) => route.fulfill(json(SESSIONS)))
}

test.describe('persistent session', () => {
  test('restores a session from the stored refresh token', async ({ page }) => {
    const refreshCalls: string[] = []
    await seedStoredSession(page)
    await stubSignedInApi(page)
    await page.route(`${API}/auth/refresh`, async (route) => {
      refreshCalls.push(route.request().postData() ?? '')
      await route.fulfill(
        json({
          access_token: 'fresh-access',
          token_type: 'bearer',
          refresh_token: 'rotated-refresh',
          expires_in: 900,
          session_id: 'session-current',
        }),
      )
    })

    await page.goto('/')

    // No password prompt: the app exchanged the stored token instead.
    await expect(page.getByPlaceholder('Search chats')).toBeVisible()
    await expect(page.getByLabel('Username or email')).toHaveCount(0)
    expect(refreshCalls[0]).toContain('stored-refresh-token')

    // The rotated token replaces the one that was just spent.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('qq.secret.refresh-token')))
      .toBe('rotated-refresh')
  })

  test('asks for a password again when the refresh is rejected', async ({ page }) => {
    await seedStoredSession(page)
    await stubSignedInApi(page)
    await page.route(`${API}/auth/refresh`, (route) =>
      route.fulfill(json({ detail: 'Refresh token revoked' }, 401)),
    )

    await page.goto('/')

    await expect(page.getByLabel('Username or email')).toBeVisible()
    await expect(page.getByText('Session expired. Please sign in again.')).toBeVisible()
    // A dead credential must not be left behind to be retried forever.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('qq.secret.refresh-token')))
      .toBeNull()
  })

  test('keeps the session when the refresh fails transiently', async ({ page }) => {
    await seedStoredSession(page)
    await stubSignedInApi(page)
    await page.route(`${API}/auth/refresh`, (route) =>
      route.fulfill(json({ detail: 'Bad gateway' }, 502)),
    )

    await page.goto('/')

    // Signed out for now, but the credential survives for the next attempt:
    // a flaky network is not a reason to make someone type their password.
    await expect(page.getByLabel('Username or email')).toBeVisible()
    await expect(page.getByText('Session expired. Please sign in again.')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('qq.secret.refresh-token')))
      .toBe('stored-refresh-token')
  })

  test('lists devices and revokes another one', async ({ page }) => {
    const revoked: string[] = []
    await seedStoredSession(page)
    await stubSignedInApi(page)
    await page.route(`${API}/auth/refresh`, (route) =>
      route.fulfill(
        json({
          access_token: 'fresh-access',
          token_type: 'bearer',
          refresh_token: 'rotated-refresh',
          expires_in: 900,
          session_id: 'session-current',
        }),
      ),
    )
    await page.route(`${API}/auth/sessions/*`, async (route) => {
      revoked.push(route.request().url().split('/').pop() ?? '')
      await route.fulfill(json({ status: 'ok' }))
    })

    await page.goto('/')
    await page.getByRole('link', { name: 'Settings' }).click()

    await expect(page.getByText('Qora Qarga Desktop (Linux)')).toBeVisible()
    await expect(page.getByText('this device')).toBeVisible()
    await expect(page.getByText('iPhone 16')).toBeVisible()

    await page.getByRole('button', { name: 'Revoke' }).click()

    await expect(page.getByText('Device signed out')).toBeVisible()
    expect(revoked).toEqual(['session-phone'])
  })
})
