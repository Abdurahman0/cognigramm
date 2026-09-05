import { LogOut, UserPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Separator,
  Tooltip,
  initialsOf,
  toast,
} from '@/components/ui'
import { queryKeys } from '@/api/query-keys'
import { AttachmentView } from '@/features/chat/AttachmentView'
import { PresenceDot } from '@/features/conversations/PresenceDot'
import { useAddMembers, useRemoveMember } from '@/hooks/use-conversations'
import { useMessages } from '@/hooks/use-messages'
import { useUserSearch } from '@/hooks/use-users'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import type { Conversation, User } from '@/types'

/** Right-hand panel: who is in the conversation, and what has been shared. */
export function ConversationDetails({
  conversation,
  usersById,
}: {
  conversation: Conversation
  usersById: Map<number, User>
}) {
  const queryClient = useQueryClient()
  const setDetailsOpen = useUiStore((state) => state.setDetailsOpen)
  const currentUserId = useAuthStore((state) => state.user?.id ?? -1)
  const { data: messages } = useMessages(conversation.id)
  const [adding, setAdding] = useState(false)

  const addMembers = useAddMembers(conversation.id)
  const removeMember = useRemoveMember(conversation.id)
  const { users: candidates } = useUserSearch('', adding)

  const sharedMedia = useMemo(
    () =>
      (messages ?? [])
        .filter((message) => !message.isDeleted && message.attachments.length > 0)
        .flatMap((message) => message.attachments)
        .slice(-12)
        .reverse(),
    [messages],
  )

  const memberIds = new Set(conversation.members.map((member) => member.userId))
  const addable = candidates.filter((user) => !memberIds.has(user.id))

  return (
    <aside className="border-border/60 flex w-72 shrink-0 flex-col border-l">
      <div className="flex h-14 shrink-0 items-center justify-between px-3">
        <p className="text-[13px] font-semibold">Details</p>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Close details"
          onClick={() => setDetailsOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </div>
      <Separator />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-faint-foreground text-[11px] font-semibold tracking-wide uppercase">
              Members · {conversation.members.length}
            </h3>
            {conversation.kind === 'group' ? (
              <Tooltip content="Add member">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Add member"
                  onClick={() => setAdding((value) => !value)}
                >
                  <UserPlus className="size-4" />
                </Button>
              </Tooltip>
            ) : null}
          </div>

          <div className="space-y-0.5">
            {conversation.members.map((member) => {
              const user = usersById.get(member.userId)
              return (
                <div
                  key={member.userId}
                  className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5"
                >
                  <div className="relative">
                    <Avatar className="size-8">
                      {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="text-[11px]">
                        {initialsOf(user?.fullName ?? member.username)}
                      </AvatarFallback>
                    </Avatar>
                    <PresenceDot userId={member.userId} className="size-2.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {user?.fullName ?? member.username}
                      {member.userId === currentUserId ? ' (you)' : ''}
                    </p>
                    <p className="text-muted-foreground truncate text-[11px]">@{member.username}</p>
                  </div>
                  {member.role === 'admin' ? <Badge variant="muted">admin</Badge> : null}
                </div>
              )
            })}
          </div>

          {adding ? (
            <div className="bg-input/60 mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded-xl p-1">
              {addable.length === 0 ? (
                <p className="text-muted-foreground p-3 text-center text-[12px]">
                  Nobody left to add.
                </p>
              ) : (
                addable.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="hover:bg-accent/60 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left"
                    onClick={() =>
                      addMembers.mutate([user.id], {
                        onSuccess: () => {
                          toast.success('Member added', user.fullName)
                          setAdding(false)
                        },
                        onError: (error: Error) =>
                          toast.error('Could not add member', error.message),
                      })
                    }
                  >
                    <Avatar className="size-7">
                      <AvatarFallback className="text-[10px]">
                        {initialsOf(user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-[13px]">{user.fullName}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </section>

        {sharedMedia.length > 0 ? (
          <section>
            <h3 className="text-faint-foreground mb-2 text-[11px] font-semibold tracking-wide uppercase">
              Shared files
            </h3>
            <div className="space-y-1.5">
              {sharedMedia.map((attachment) => (
                <AttachmentView
                  key={`${attachment.id}-${attachment.name}`}
                  attachment={attachment}
                />
              ))}
            </div>
          </section>
        ) : null}

        {conversation.kind === 'group' ? (
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/15 w-full justify-start"
            onClick={() =>
              removeMember.mutate(currentUserId, {
                onSuccess: () => {
                  toast.info('You left the group')
                  queryClient.removeQueries({ queryKey: queryKeys.messages(conversation.id) })
                },
                onError: (error: Error) => toast.error('Could not leave', error.message),
              })
            }
          >
            <LogOut className="size-4" /> Leave group
          </Button>
        ) : null}
      </div>
    </aside>
  )
}
