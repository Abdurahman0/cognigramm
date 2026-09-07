import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import { toast } from '@/components/ui'
import { useConversations, useCreateConversation } from '@/hooks/use-conversations'

/**
 * Opens the direct conversation with someone, creating it on first contact.
 *
 * Shared by the contacts grid, the member list and the profile card, because
 * all three mean the same thing by "message this person" — and none of them
 * should create a second direct chat with someone who already has one.
 */
export function useOpenDirectChat() {
  const navigate = useNavigate()
  const { conversations } = useConversations()
  const create = useCreateConversation()

  return useCallback(
    (userId: number, then?: (conversationId: number) => void) => {
      const existing = conversations.find(
        (conversation) => conversation.kind === 'direct' && conversation.peerId === userId,
      )
      if (existing) {
        if (then) then(existing.id)
        else void navigate(`/chats/${existing.id}`)
        return
      }

      create.mutate(
        { type: 'direct', participant_ids: [userId] },
        {
          onSuccess: (conversation) => {
            if (then) then(conversation.id)
            else void navigate(`/chats/${conversation.id}`)
          },
          onError: (error: Error) => toast.error('Could not open chat', error.message),
        },
      )
    },
    [conversations, create, navigate],
  )
}
