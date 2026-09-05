import { expect, test, type Page } from '@playwright/test'

/**
 * Smoke coverage for the shell before any account exists.
 *
 * The API is stubbed at the network layer so the suite says something about
 * the frontend rather than about whether the backend happens to be up.
 *
 * Patterns are host-qualified on purpose: a bare `**\/conversations**` also
 * matches the dev server's own module URLs, which would replace application
 * source with a JSON stub and leave a blank page.
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

const json = (body: unknown, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

/** Everything the app asks for right after a successful sign-in. */
const stubSignedInApi = async (page: Page) => {
  await page.route(`${API}/auth/login`, (route) =>
    route.fulfill(json({ access_token: 'test-token', token_type: 'bearer' })),
  )
  await page.route(`${API}/users/me`, (route) => route.fulfill(json(ME)))
  await page.route(`${API}/users?**`, (route) => route.fulfill(json([])))
  await page.route(`${API}/conversations?**`, (route) => route.fulfill(json([])))
  await page.route(`${API}/presence/**`, (route) => route.fulfill(json([])))
}

test.describe('sign-in', () => {
  test('shows the sign-in form on a clean profile', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { name: "Qora Qarg'a" })).toBeVisible()
    await expect(page.getByLabel('Username or email')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('refuses to submit an empty form', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Enter your username or email')).toBeVisible()
    await expect(page.getByText('Enter your password')).toBeVisible()
  })

  test('reports a rejected password instead of hanging', async ({ page }) => {
    await page.route(`${API}/auth/login`, (route) =>
      route.fulfill(json({ detail: 'Invalid credentials' }, 401)),
    )

    await page.goto('/')
    await page.getByLabel('Username or email').fill('ann')
    await page.getByLabel('Password', { exact: true }).fill('wrong-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Sign-in failed')).toBeVisible()
    await expect(page.getByText('Wrong username or password.')).toBeVisible()
  })

  test('validates the registration form before calling the API', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: 'Register' }).click()

    await expect(page.getByLabel('Username')).toBeVisible()
    await page.getByLabel('Username').fill('a')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByText('At least 3 characters')).toBeVisible()
    await expect(page.getByText('Enter a valid email')).toBeVisible()
  })

  test('signs in and lands on the chat list', async ({ page }) => {
    await stubSignedInApi(page)

    await page.goto('/')
    await page.getByLabel('Username or email').fill('ann')
    await page.getByLabel('Password', { exact: true }).fill('correct-horse')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByPlaceholder('Search chats')).toBeVisible()
    await expect(page.getByText('No conversations yet.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Contacts' })).toBeVisible()
  })

  test('navigates between the rail destinations', async ({ page }) => {
    await stubSignedInApi(page)
    await page.route(`${API}/calls/history?**`, (route) =>
      route.fulfill(json({ total: 0, calls: [] })),
    )

    await page.goto('/')
    await page.getByLabel('Username or email').fill('ann')
    await page.getByLabel('Password', { exact: true }).fill('correct-horse')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByPlaceholder('Search chats')).toBeVisible()

    await page.getByRole('link', { name: 'Calls' }).click()
    await expect(page.getByRole('heading', { name: 'Calls' })).toBeVisible()
    await expect(page.getByText('No calls yet.')).toBeVisible()

    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('Ann Karimova')).toBeVisible()
    await expect(page.getByText(API)).toBeVisible()
  })
})
