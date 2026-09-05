import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { toUser } from '@/api/adapters'
import { presenceApi, usersApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { useChatStore } from '@/stores/chat'
import type { ApiUser } from '@/api/types'
import type { User } from '@/types'

/** The server rejects a `limit` above 100 outright, so nothing may exceed it. */
const MAX_PAGE = 100

export function useUserSearch(term: string, enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.users(term),
    queryFn: () => usersApi.search({ q: term, limit: 40 }),
    enabled,
    staleTime: 30_000,
  })

  const users = useMemo<User[]>(
    () => (Array.isArray(query.data) ? query.data : []).map(toUser),
    [query.data],
  )
  return { ...query, users }
}

/**
 * The directory, indexed by id.
 *
 * A conversation row only carries `user_id` and `username`, so anything richer
 * — avatar, title, presence — comes from here. One query serves every screen.
 */
export function useDirectory() {
  const query = useQuery({
    queryKey: queryKeys.users(''),
    queryFn: async () => {
      // Paged rather than one big request: the endpoint caps a page at 100 and
      // answers 422 — not a truncated list — for anything larger.
      const rows: ApiUser[] = []
      for (let page = 0; page < 5; page += 1) {
        const batch = await usersApi.search({
          limit: MAX_PAGE,
          offset: page * MAX_PAGE,
          includeSelf: true,
        })
        if (!Array.isArray(batch) || batch.length === 0) break
        rows.push(...batch)
        if (batch.length < MAX_PAGE) break
      }
      return rows
    },
    staleTime: 5 * 60_000,
  })

  const byId = useMemo(() => {
    const map = new Map<number, User>()
    for (const row of Array.isArray(query.data) ? query.data : []) map.set(row.id, toUser(row))
    return map
  }, [query.data])

  return { ...query, byId }
}

/** Seeds the online set once; the socket keeps it current from then on. */
export function useOnlinePresence(enabled: boolean) {
  const setOnlineUsers = useChatStore((state) => state.setOnlineUsers)

  return useQuery({
    queryKey: queryKeys.onlineUsers,
    queryFn: async () => {
      const ids = await presenceApi.onlineUsers()
      const safe = Array.isArray(ids) ? ids : []
      setOnlineUsers(safe)
      return safe
    },
    enabled,
    refetchInterval: 120_000,
  })
}
