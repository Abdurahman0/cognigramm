import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The refresh contract is unforgiving — a replayed refresh token revokes the
 * whole device session — so these cover the rules that keep that from
 * happening: one refresh at a time, one use per token, and a transient failure
 * leaving the session alone.
 */

const vault = new Map<string, string>()
const fetchMock = vi.fn()

vi.mock('@/api/transport', () => ({
  getTransport: () => Promise.resolve(fetchMock),
}))

vi.mock('@/lib/secure-store', () => ({
  secureStore: {
    set: (key: string, value: string) => {
      vault.set(key, value)
      return Promise.resolve()
    },
    get: (key: string) => Promise.resolve(vault.get(key) ?? null),
    clear: (key: string) => {
      vault.delete(key)
      return Promise.resolve()
    },
  },
  describeDevice: () => Promise.resolve('Test device'),
}))

const tokenResponse = (accessToken: string, refreshToken: string, expiresIn = 900) => ({
  ok: true,
  status: 200,
  json: () =>
    Promise.resolve({
      access_token: accessToken,
      token_type: 'bearer',
      refresh_token: refreshToken,
      expires_in: expiresIn,
      session_id: 'session-1',
    }),
})

const loadSession = async () => {
  vi.resetModules()
  return import('@/api/session')
}

beforeEach(() => {
  vault.clear()
  fetchMock.mockReset()
  // `navigator.locks` is absent in jsdom, which exercises the in-process path.
})

describe('token lifecycle', () => {
  it('stores the rotated refresh token and hands back the access token', async () => {
    const session = await loadSession()
    await session.adoptTokens({
      access_token: 'access-1',
      token_type: 'bearer',
      refresh_token: 'refresh-1',
      expires_in: 900,
      session_id: 'session-1',
    })

    expect(session.getAccessToken()).toBe('access-1')
    expect(session.getAuthSessionId()).toBe('session-1')
    await expect(session.hasStoredSession()).resolves.toBe(true)
  })

  it('reuses a token that is not near expiry instead of refreshing', async () => {
    const session = await loadSession()
    await session.adoptTokens({
      access_token: 'access-1',
      token_type: 'bearer',
      refresh_token: 'refresh-1',
      expires_in: 900,
      session_id: 'session-1',
    })

    await expect(session.ensureAccessToken()).resolves.toBe('access-1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes once when several callers race an expiring token', async () => {
    const session = await loadSession()
    // 30 seconds left is inside the skew window, so this must refresh.
    await session.adoptTokens({
      access_token: 'access-1',
      token_type: 'bearer',
      refresh_token: 'refresh-1',
      expires_in: 30,
      session_id: 'session-1',
    })

    fetchMock.mockResolvedValue(tokenResponse('access-2', 'refresh-2'))

    const [a, b, c] = await Promise.all([
      session.ensureAccessToken(),
      session.ensureAccessToken(),
      session.ensureAccessToken(),
    ])

    expect([a, b, c]).toEqual(['access-2', 'access-2', 'access-2'])
    // Three callers, one network refresh: a second one would be read as token
    // reuse and revoke the session.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vault.get('refresh-token')).toBe('refresh-2')
  })

  it('ends the session when the refresh is rejected', async () => {
    const session = await loadSession()
    const lost = vi.fn()
    session.setSessionLostHandler(lost)

    await session.adoptTokens({
      access_token: 'access-1',
      token_type: 'bearer',
      refresh_token: 'refresh-1',
      expires_in: 1,
      session_id: 'session-1',
    })

    fetchMock.mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })

    await expect(session.ensureAccessToken()).resolves.toBeNull()
    expect(lost).toHaveBeenCalledOnce()
    await expect(session.hasStoredSession()).resolves.toBe(false)
  })

  it('keeps the session through a server error or a dead network', async () => {
    const session = await loadSession()
    const lost = vi.fn()
    session.setSessionLostHandler(lost)

    await session.adoptTokens({
      access_token: 'access-1',
      token_type: 'bearer',
      refresh_token: 'refresh-1',
      expires_in: 1,
      session_id: 'session-1',
    })

    fetchMock.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) })
    await expect(session.ensureAccessToken()).resolves.toBeNull()

    fetchMock.mockRejectedValue(new Error('offline'))
    await expect(session.ensureAccessToken()).resolves.toBeNull()

    // Neither is a reason to throw the user back to the login screen, and the
    // stored refresh token must survive both.
    expect(lost).not.toHaveBeenCalled()
    await expect(session.hasStoredSession()).resolves.toBe(true)
  })

  it('treats a rejected origin as fatal rather than looping', async () => {
    const session = await loadSession()
    const lost = vi.fn()
    session.setSessionLostHandler(lost)

    await session.adoptTokens({
      access_token: 'access-1',
      token_type: 'bearer',
      refresh_token: 'refresh-1',
      expires_in: 1,
      session_id: 'session-1',
    })

    fetchMock.mockResolvedValue({ ok: false, status: 403, json: () => Promise.resolve({}) })
    await expect(session.ensureAccessToken()).resolves.toBeNull()
    expect(lost).toHaveBeenCalledWith(expect.stringContaining('origin'))
  })

  it('reports no session when nothing is stored', async () => {
    const session = await loadSession()
    const lost = vi.fn()
    session.setSessionLostHandler(lost)

    await expect(session.ensureAccessToken()).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(lost).toHaveBeenCalledOnce()
  })
})
