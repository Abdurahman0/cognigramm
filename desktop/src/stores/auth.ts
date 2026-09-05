import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { toUser } from '@/api/adapters'
import { authApi, usersApi } from '@/api/endpoints'
import {
  adoptTokens,
  clearSession,
  ensureAccessToken,
  hasStoredSession,
  setSessionLostHandler,
} from '@/api/session'
import type { ApiTokenResponse } from '@/api/types'
import type { User } from '@/types'

type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'

interface AuthState {
  user: User | null
  status: AuthStatus
  /** Stable per install; identifies this client to the presence tracker. */
  deviceId: string
  /** Fresh per launch: two windows must not look like one presence session. */
  presenceSessionId: string
  /** The device session the current tokens belong to, from the login response. */
  authSessionId: string | null
  /** Set when a session ends for a reason worth showing on the login screen. */
  endedReason: string | null

  signIn: (tokens: ApiTokenResponse, user: User) => Promise<void>
  setUser: (user: User) => void
  signOut: (reason?: string) => Promise<void>
  /** Called once at startup: refresh first, then load the profile. */
  bootstrap: () => Promise<void>
}

const randomId = (prefix: string): string =>
  `${prefix}_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      status: 'unknown',
      deviceId: randomId('device'),
      presenceSessionId: randomId('presence'),
      authSessionId: null,
      endedReason: null,

      signIn: async (tokens, user) => {
        await adoptTokens(tokens)
        set({ user, status: 'authenticated', authSessionId: tokens.session_id, endedReason: null })
      },

      setUser: (user) => set({ user }),

      signOut: async (reason) => {
        // Tell the server first: that revokes the device session and closes
        // any socket it still holds. A failure here is not worth blocking on —
        // the local credentials go either way.
        try {
          await authApi.logout()
        } catch {
          // Offline or already revoked.
        }
        await clearSession()
        set({ user: null, status: 'anonymous', authSessionId: null, endedReason: reason ?? null })
      },

      bootstrap: async () => {
        if (!(await hasStoredSession())) {
          set({ status: 'anonymous' })
          return
        }

        // The stored refresh token is the only durable credential; the access
        // token lives 15 minutes and never survives a restart.
        const token = await ensureAccessToken()
        if (!token) {
          // `setSessionLostHandler` has already flipped the status if the
          // refresh was rejected outright. A transient failure leaves the
          // session alone and the app retries on the next request.
          if (get().status === 'unknown') set({ status: 'anonymous' })
          return
        }

        try {
          const profile = await usersApi.me()
          set({ user: toUser(profile), status: 'authenticated' })
        } catch {
          set({ status: 'anonymous' })
        }
      },
    }),
    {
      name: 'qq.auth',
      storage: createJSONStorage(() => localStorage),
      // Only the non-secret parts. Tokens live in `src/api/session.ts`, whose
      // refresh token goes to the OS-side secure store.
      partialize: (state) => ({ user: state.user, deviceId: state.deviceId }),
    },
  ),
)

/**
 * A dead session anywhere — a rejected refresh, a revoked device, a socket
 * closed with 4001 — lands here and returns the window to the login screen.
 */
setSessionLostHandler((reason) => {
  const state = useAuthStore.getState()
  if (state.status === 'anonymous') return
  void clearSession()
  useAuthStore.setState({
    user: null,
    status: 'anonymous',
    authSessionId: null,
    endedReason: reason,
  })
})
