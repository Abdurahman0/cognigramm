import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { toConversation } from '@/api/adapters'
import { conversationsApi } from '@/api/endpoints'
import { queryKeys } from '@/api/query-keys'
import { useAuthStore } from '@/stores/auth'
import type { Conversation } from '@/types'

export function useConversations() {
  const currentUserId = useAuthStore((state) => state.user?.id ?? -1)

  const query = useQuery({
    queryKey: queryKeys.conversations,
    queryFn: () => conversationsApi.list(),
    // The socket pushes membership changes, so polling is a safety net for a
    // missed frame rather than the primary path.
    refetchInterval: 60_000,
    staleTime: 15_000,
  })

  const conversations = useMemo<Conversation[]>(
    () =>
      (Array.isArray(query.data) ? query.data : []).map((row) =>
        toConversation(row, currentUserId),
      ),
    [query.data, currentUserId],
  )

  return { ...query, conversations }
}

export function useConversation(conversationId: number | null) {
  const { conversations } = useConversations()
  return useMemo(
    () => conversations.find((conversation) => conversation.id === conversationId) ?? null,
    [conversations, conversationId],
  )
}

export function useCreateConversation() {
  const queryClient = useQueryClient()
  const currentUserId = useAuthStore((state) => state.user?.id ?? -1)

  return useMutation({
    mutationFn: (payload: {
      type: 'direct' | 'group'
      title?: string
      participant_ids: number[]
    }) => conversationsApi.create(payload),
    onSuccess: (created) => {
      queryClient.setQueryData(
        queryKeys.conversations,
        (previous: (typeof created)[] | undefined) => {
          const rows = previous ?? []
          return rows.some((row) => row.id === created.id) ? rows : [created, ...rows]
        },
      )
      void queryClient.invalidateQueries({ queryKey: queryKeys.conversations })
    },
    meta: { currentUserId },
  })
}

export function useAddMembers(conversationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userIds: number[]) => conversationsApi.addMembers(conversationId, userIds),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
  })
}

export function useRemoveMember(conversationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) => conversationsApi.removeMember(conversationId, userId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.conversations }),
  })
}
