import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { toUser } from '@/api/adapters'
import { usersApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

/**
 * Keeps the signed-in profile current.
 *
 * Session restoration itself happens in `useAuthStore.bootstrap`, which
 * refreshes the token before anything else runs; this query only re-reads the
 * profile afterwards, so a name or avatar changed on another device shows up.
 */
export function useSession() {
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated')
  const setUser = useAuthStore((state) => state.setUser)

  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => usersApi.me(),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
    // A 4xx here is answered by the auth layer, not by trying again.
    retry: (failureCount, error) =>
      failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
  })

  useEffect(() => {
    if (query.data) setUser(toUser(query.data))
  }, [query.data, setUser])

  return query
}
