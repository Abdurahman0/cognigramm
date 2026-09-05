import { MessageSquare } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { ChatHeader } from '@/features/chat/ChatHeader'
import { Composer } from '@/features/chat/Composer'
import { ConversationDetails } from '@/features/chat/ConversationDetails'
import { MessageList } from '@/features/chat/MessageList'
import { PinnedBar } from '@/features/chat/PinnedBar'
import { SearchPanel } from '@/features/chat/SearchPanel'
import { useConversation } from '@/hooks/use-conversations'
import { useLoadOlderMessages, useMessages } from '@/hooks/use-messages'
import { useDirectory } from '@/hooks/use-users'
import { realtime } from '@/realtime/socket'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import type { Message } from '@/types'

export function ChatEmptyState() {
  return (
    <div className="grid flex-1 place-items-center px-8 text-center">
      <div className="space-y-2">
        <MessageSquare className="text-faint-foreground mx-auto size-10" />
        <p className="text-[14px] font-medium">Pick a conversation</p>
        <p className="text-muted-foreground text-[13px]">
          Choose a chat on the left, or start a new one.
        </p>
      </div>
    </div>
  )
}

/** The transcript pane: everything to the right of the conversation list. */
export function ChatScreen() {
  const params = useParams<{ conversationId?: string }>()
  const conversationId = params.conversationId ? Number(params.conversationId) : null

  const conversation = useConversation(conversationId)
  const { byId } = useDirectory()
  const { data: messages, isPending } = useMessages(conversationId)
  const { loadOlder, isLoading: isLoadingMore, hasMore } = useLoadOlderMessages(conversationId)

  const setActiveConversation = useChatStore((state) => state.setActiveConversation)
  const clearUnread = useChatStore((state) => state.clearUnread)
  const detailsOpen = useUiStore((state) => state.detailsOpen)

  const [searchOpen, setSearchOpen] = useState(false)
  const [editing, setEditing] = useState<Message | null>(null)

  // Opening a chat joins its room, tells the server it is on screen, and
  // clears the badge. Closing it clears the active conversation so presence
  // does not keep reporting a chat nobody is looking at.
  useEffect(() => {
    if (conversationId === null) {
      setActiveConversation(null)
      realtime.setActiveConversation(null)
      return
    }

    setActiveConversation(conversationId)
    clearUnread(conversationId)
    realtime.joinConversation(conversationId)
    realtime.setActiveConversation(conversationId)

    return () => {
      realtime.setActiveConversation(null)
    }
  }, [conversationId, setActiveConversation, clearUnread])

  // Switching chats must not carry an unfinished edit across.
  useEffect(() => {
    setEditing(null)
    setSearchOpen(false)
  }, [conversationId])

  const jumpTo = useCallback((messageId: number) => {
    const node = document.querySelector(`[data-message-id="${messageId}"]`)
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  if (!conversation || conversationId === null) return <ChatEmptyState />

  const peer = conversation.peerId ? byId.get(conversation.peerId) : undefined

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          conversation={conversation}
          peer={peer}
          searchOpen={searchOpen}
          onToggleSearch={() => setSearchOpen((value) => !value)}
        />
        {searchOpen ? <SearchPanel conversationId={conversationId} onJumpTo={jumpTo} /> : null}
        <PinnedBar conversationId={conversationId} onJumpTo={jumpTo} />

        <MessageList
          conversation={conversation}
          messages={messages ?? []}
          usersById={byId}
          isPending={isPending}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadOlder={loadOlder}
          onEdit={setEditing}
        />

        <Composer
          conversationId={conversationId}
          editing={editing}
          onCancelEdit={() => setEditing(null)}
        />
      </div>

      {detailsOpen ? <ConversationDetails conversation={conversation} usersById={byId} /> : null}
    </div>
  )
}
