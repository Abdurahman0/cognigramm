import { MessageSquare, Phone, Search, Video } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
  Skeleton,
  Tooltip,
  initialsOf,
  toast,
} from '@/components/ui'
import { callEngine } from '@/features/calls/call-engine'
import { PresenceDot } from '@/features/conversations/PresenceDot'
import { useConversations, useCreateConversation } from '@/hooks/use-conversations'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useUserSearch } from '@/hooks/use-users'
import { formatLastSeen } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import type { User } from '@/types'

/** The directory. Every row can start a chat or place a call directly. */
export function ContactsPage() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const debounced = useDebouncedValue(term, 250)
  const { users, isPending } = useUserSearch(debounced)
  const { conversations } = useConversations()
  const create = useCreateConversation()
  const currentUserId = useAuthStore((state) => state.user?.id ?? -1)
  const onlineIds = useChatStore((state) => state.onlineUserIds)

  /** Reuses the existing direct chat when there is one. */
  const openChat = (user: User, then?: (conversationId: number, peerId: number) => void) => {
    const existing = conversations.find((row) => row.kind === 'direct' && row.peerId === user.id)
    if (existing) {
      if (then) then(existing.id, user.id)
      else void navigate(`/chats/${existing.id}`)
      return
    }

    create.mutate(
      { type: 'direct', participant_ids: [user.id] },
      {
        onSuccess: (conversation) => {
          if (then) then(conversation.id, user.id)
          else void navigate(`/chats/${conversation.id}`)
        },
        onError: (error: Error) => toast.error('Could not open chat', error.message),
      },
    )
  }

  const visible = users.filter((user) => user.id !== currentUserId)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="border-border/60 flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <h1 className="text-[15px] font-semibold">Contacts</h1>
        <div className="relative ml-auto w-64">
          <Search className="text-faint-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search people"
            className="h-9 pl-8 text-[13px]"
            aria-label="Search people"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="mx-auto w-full max-w-5xl">
          {isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-[13px]">No people found.</p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((user) => (
                <div
                  key={user.id}
                  className="raised-card flex items-center gap-3 rounded-xl px-3 py-2.5"
                >
                  <div className="relative">
                    <Avatar className="size-10">
                      {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                      <AvatarFallback>{initialsOf(user.fullName)}</AvatarFallback>
                    </Avatar>
                    <PresenceDot userId={user.id} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{user.fullName}</p>
                    <p className="text-muted-foreground truncate text-[12px]">
                      {onlineIds.includes(user.id)
                        ? 'online'
                        : user.title || formatLastSeen(user.lastSeenAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-0.5">
                    <Tooltip content="Message">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Message ${user.fullName}`}
                        onClick={() => openChat(user)}
                      >
                        <MessageSquare className="size-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Audio call">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Call ${user.fullName}`}
                        onClick={() =>
                          openChat(
                            user,
                            (conversationId, peerId) =>
                              void callEngine.start(conversationId, peerId, 'audio'),
                          )
                        }
                      >
                        <Phone className="size-4" />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Video call">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Video call ${user.fullName}`}
                        onClick={() =>
                          openChat(
                            user,
                            (conversationId, peerId) =>
                              void callEngine.start(conversationId, peerId, 'video'),
                          )
                        }
                      >
                        <Video className="size-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
