import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { setAuthToken, setUnauthorizedHandler } from '@/api/client'
import type { User } from '@/types'

interface AuthState {
  token: string | null
  user: User | null
  /** Stable per install; the backend uses it to separate concurrent sessions. */
  deviceId: string
  sessionId: string
  status: 'unknown' | 'authenticated' | 'anonymous'
  signIn: (token: string, user: User) => void
  setUser: (user: User) => void
  signOut: () => void
  markResolved: () => void
}

const randomId = (prefix: string): string =>
  `${prefix}_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      deviceId: randomId('device'),
      // A fresh session id per launch: two open windows should not be treated
      // as one socket by the presence tracker.
      sessionId: randomId('session'),
      status: 'unknown',
      signIn: (token, user) => {
        setAuthToken(token)
        set({ token, user, status: 'authenticated' })
      },
      setUser: (user) => set({ user }),
      signOut: () => {
        setAuthToken(null)
        set({ token: null, user: null, status: 'anonymous' })
      },
      markResolved: () => set((state) => ({ status: state.token ? 'authenticated' : 'anonymous' })),
    }),
    {
      name: 'qq.auth',
      storage: createJSONStorage(() => localStorage),
      // The session id is per launch, and `status` is derived — persisting
      // either would resurrect stale state on the next start.
      partialize: (state) => ({ token: state.token, user: state.user, deviceId: state.deviceId }),
      onRehydrateStorage: () => (state) => {
        setAuthToken(state?.token ?? null)
        state?.markResolved()
      },
    },
  ),
)

/** A 401 anywhere means the token is dead; drop it and fall back to the login screen. */
setUnauthorizedHandler(() => {
  const { token, signOut } = useAuthStore.getState()
  if (token) signOut()
})

export const selectCurrentUserId = (state: AuthState): number => state.user?.id ?? -1
