import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { toUser } from '@/api/adapters'
import { usersApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { useAuthStore } from '@/stores/auth'

/**
 * Confirms a restored token still works and refreshes the profile.
 *
 * A persisted token is only a guess: it may have expired while the app was
 * closed. The 401 handler in the API client turns a rejection here into a
 * sign-out, which is what routes the window back to the login screen.
 */
export function useSession() {
  const token = useAuthStore((state) => state.token)
  const setUser = useAuthStore((state) => state.setUser)

  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => usersApi.me(),
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
    retry: (failureCount, error) =>
      // Retrying a 401 would only repeat the sign-out.
      failureCount < 2 && !(error as { status?: number }).status?.toString().startsWith('4'),
  })

  useEffect(() => {
    if (query.data) setUser(toUser(query.data))
  }, [query.data, setUser])

  return query
}
