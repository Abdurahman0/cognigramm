import { ArrowDown } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { Button, Skeleton, Spinner } from '@/components/ui'
import { MessageBubble } from '@/features/chat/MessageBubble'
import { TypingIndicator } from '@/features/chat/TypingIndicator'
import { useDeleteMessage, useMarkRead, useTogglePin } from '@/hooks/use-messages'
import { formatDayDivider, sameDay } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import type { Conversation, Message, User } from '@/types'

/** Within this distance of the bottom, new messages scroll into view. */
const STICK_THRESHOLD_PX = 120
/** Within this distance of the top, the next page is requested. */
const LOAD_MORE_THRESHOLD_PX = 200
/** A run of messages from one sender breaks after this gap. */
const GROUPING_WINDOW_MS = 5 * 60_000

interface MessageListProps {
  conversation: Conversation
  messages: Message[]
  usersById: Map<number, User>
  isPending: boolean
  hasMore: boolean
  isLoadingMore: boolean
  onLoadOlder: () => void
  onEdit: (message: Message) => void
  onForward: (message: Message) => void
}

export function MessageList({
  conversation,
  messages,
  usersById,
  isPending,
  hasMore,
  isLoadingMore,
  onLoadOlder,
  onEdit,
  onForward,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [stuckToBottom, setStuckToBottom] = useState(true)

  const currentUserId = useAuthStore((state) => state.user?.id ?? -1)
  const setReplyTo = useChatStore((state) => state.setReplyTo)
  const deleteMessage = useDeleteMessage()
  const togglePin = useTogglePin()
  const markRead = useMarkRead()

  const byId = useMemo(() => {
    const map = new Map<number, Message>()
    for (const message of messages) map.set(message.id, message)
    return map
  }, [messages])

  const lastMessageId = messages[messages.length - 1]?.id ?? 0

  // Follow the conversation only when the reader is already at the bottom;
  // yanking the viewport while they read history is the classic chat bug.
  useLayoutEffect(() => {
    if (!stuckToBottom) return
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [lastMessageId, stuckToBottom])

  // A fresh conversation always opens at the newest message.
  useLayoutEffect(() => {
    setStuckToBottom(true)
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: 'end' }))
  }, [conversation.id])

  // Reading the newest message is what clears the badge for everyone.
  useEffect(() => {
    if (!stuckToBottom || lastMessageId <= 0) return
    const newest = messages[messages.length - 1]
    if (newest && newest.senderId !== currentUserId) markRead(newest.id)
  }, [lastMessageId, stuckToBottom, messages, currentUserId, markRead])

  const handleScroll = useCallback(() => {
    const element = scrollRef.current
    if (!element) return

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    setStuckToBottom(distanceFromBottom < STICK_THRESHOLD_PX)

    if (element.scrollTop < LOAD_MORE_THRESHOLD_PX && hasMore && !isLoadingMore) {
      // Anchor the view so growing the list upward does not move the reader.
      const previousHeight = element.scrollHeight
      onLoadOlder()
      requestAnimationFrame(() => {
        const grown = element.scrollHeight - previousHeight
        if (grown > 0) element.scrollTop += grown
      })
    }
  }, [hasMore, isLoadingMore, onLoadOlder])

  const jumpTo = useCallback((messageId: number) => {
    const node = scrollRef.current?.querySelector(`[data-message-id="${messageId}"]`)
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    node?.animate?.([{ opacity: 0.45 }, { opacity: 1 }], { duration: 700 })
  }, [])

  if (isPending) {
    return (
      <div className="flex-1 space-y-3 p-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className={index % 3 === 0 ? 'ml-auto h-10 w-1/3' : 'h-10 w-2/5'} />
        ))}
      </div>
    )
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* `justify-end` on the scroller plus a growing inner column keeps a short
          transcript sitting on the composer instead of hanging from the top. */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto"
      >
        {/* A readable column: bubbles pinned to the far edges of a wide
            window make a two-person conversation hard to follow. */}
        <div className="mx-auto w-full max-w-[62rem] py-3">
          {isLoadingMore ? (
            <div className="flex justify-center py-2">
              <Spinner className="text-muted-foreground" />
            </div>
          ) : null}

          {messages.length === 0 ? (
            <div className="grid h-full place-items-center px-8 text-center">
              <p className="text-muted-foreground text-[13px]">
                No messages yet. Say hello to start the conversation.
              </p>
            </div>
          ) : null}

          {messages.map((message, index) => {
            const previous = messages[index - 1]
            const showDivider = !previous || !sameDay(previous.createdAt, message.createdAt)
            const isGroupStart =
              showDivider ||
              !previous ||
              previous.senderId !== message.senderId ||
              new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() >
                GROUPING_WINDOW_MS

            return (
              <div key={message.clientMessageId || message.id}>
                {showDivider ? (
                  <div className="my-3 flex justify-center">
                    <span className="text-muted-foreground rounded-full bg-black/15 px-2.5 py-0.5 text-[11px] font-medium">
                      {formatDayDivider(message.createdAt)}
                    </span>
                  </div>
                ) : null}
                <MessageBubble
                  message={message}
                  isMine={message.senderId === currentUserId}
                  sender={message.senderId ? usersById.get(message.senderId) : undefined}
                  showAuthor={conversation.kind === 'group'}
                  isGroupStart={isGroupStart}
                  replyTo={
                    message.replyToMessageId ? byId.get(message.replyToMessageId) : undefined
                  }
                  onReply={(target) =>
                    setReplyTo({
                      conversationId: conversation.id,
                      messageId: target.id,
                      preview: target.body || target.attachments[0]?.name || 'Attachment',
                    })
                  }
                  onEdit={onEdit}
                  onForward={onForward}
                  onDelete={(target) => deleteMessage(target.id)}
                  onTogglePin={(target) => togglePin(target.id, target.isPinned)}
                  onJumpTo={jumpTo}
                />
              </div>
            )
          })}

          <TypingIndicator conversationId={conversation.id} usersById={usersById} />
          <div ref={bottomRef} />
        </div>
      </div>

      {!stuckToBottom ? (
        <Button
          size="icon"
          variant="secondary"
          aria-label="Jump to latest"
          onClick={() => {
            setStuckToBottom(true)
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
          }}
          className="glass-floating absolute right-5 bottom-4 shadow-lg"
        >
          <ArrowDown className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}
