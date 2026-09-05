import { memo } from 'react'
import { NavLink } from 'react-router-dom'

import { Avatar, AvatarFallback, AvatarImage, Badge, initialsOf } from '@/components/ui'
import { PresenceDot } from '@/features/conversations/PresenceDot'
import { useLastMessage, previewOf } from '@/hooks/use-last-message'
import { formatListTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import type { Conversation, User } from '@/types'

interface ConversationRowProps {
  conversation: Conversation
  peer: User | undefined
}

function ConversationRowBase({ conversation, peer }: ConversationRowProps) {
  const { data: lastMessage } = useLastMessage(conversation.id)
  const unread = useChatStore((state) => state.unreadByConversation[conversation.id] ?? 0)
  const typingIds = useChatStore((state) => state.typingByConversation[conversation.id])
  const currentUserId = useAuthStore((state) => state.user?.id ?? -1)

  const isTyping = Boolean(typingIds && typingIds.length > 0)
  const title =
    conversation.kind === 'direct' ? (peer?.fullName ?? conversation.title) : conversation.title
  const mine = lastMessage?.senderId === currentUserId

  return (
    <NavLink
      to={`/chats/${conversation.id}`}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors',
          isActive ? 'selection-bead' : 'hover:bg-accent/60',
        )
      }
    >
      <div className="relative">
        <Avatar className="size-10">
          {peer?.avatarUrl ? <AvatarImage src={peer.avatarUrl} alt="" /> : null}
          <AvatarFallback>{initialsOf(title)}</AvatarFallback>
        </Avatar>
        <PresenceDot userId={conversation.peerId} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[14px] font-medium">{title}</p>
          {lastMessage ? (
            <span className="text-faint-foreground shrink-0 text-[11px] tabular-nums">
              {formatListTime(lastMessage.createdAt)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'truncate text-[13px]',
              isTyping ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {isTyping ? 'typing…' : `${mine ? 'You: ' : ''}${previewOf(lastMessage)}`}
          </p>
          {unread > 0 ? <Badge>{unread > 99 ? '99+' : unread}</Badge> : null}
        </div>
      </div>
    </NavLink>
  )
}

/** Rows re-render on every socket frame otherwise; the list can be long. */
export const ConversationRow = memo(ConversationRowBase)
