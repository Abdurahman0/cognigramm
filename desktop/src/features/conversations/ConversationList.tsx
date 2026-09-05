import { Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button, Input, Skeleton, Tooltip } from '@/components/ui'
import { ConversationRow } from '@/features/conversations/ConversationRow'
import { NewConversationDialog } from '@/features/conversations/NewConversationDialog'
import { useConversations } from '@/hooks/use-conversations'
import { useDirectory } from '@/hooks/use-users'

/**
 * The left column: search, the conversation list, and the entry point for
 * starting a new one.
 */
export function ConversationList() {
  const [term, setTerm] = useState('')
  const [creating, setCreating] = useState(false)
  const { conversations, isPending } = useConversations()
  const { byId } = useDirectory()

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    if (!needle) return conversations
    return conversations.filter((conversation) => {
      const peer = conversation.peerId ? byId.get(conversation.peerId) : undefined
      const haystack = `${conversation.title} ${peer?.fullName ?? ''} ${peer?.username ?? ''}`
      return haystack.toLowerCase().includes(needle)
    })
  }, [conversations, term, byId])

  return (
    <aside className="border-border/60 flex w-[19rem] shrink-0 flex-col border-r">
      <div className="flex items-center gap-2 p-3 pb-2">
        <div className="relative flex-1">
          <Search className="text-faint-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search chats"
            className="h-9 pr-8 pl-8 text-[13px]"
            aria-label="Search chats"
          />
          {term ? (
            <button
              type="button"
              onClick={() => setTerm('')}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-0.5"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <Tooltip content="New conversation">
          <Button
            size="icon"
            variant="secondary"
            onClick={() => setCreating(true)}
            aria-label="New conversation"
          >
            <Plus className="size-4" />
          </Button>
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {isPending ? (
          Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-2.5 py-2">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground px-3 py-8 text-center text-[13px]">
            {term ? 'Nothing matches that search.' : 'No conversations yet.'}
          </p>
        ) : (
          filtered.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              peer={conversation.peerId ? byId.get(conversation.peerId) : undefined}
            />
          ))
        )}
      </div>

      <NewConversationDialog open={creating} onOpenChange={setCreating} />
    </aside>
  )
}
