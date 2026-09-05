import { Check, Search, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Spinner,
  initialsOf,
  toast,
} from '@/components/ui'
import { useConversations, useCreateConversation } from '@/hooks/use-conversations'
import { useUserSearch } from '@/hooks/use-users'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'

interface NewConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewConversationDialog({ open, onOpenChange }: NewConversationDialogProps) {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [groupTitle, setGroupTitle] = useState('')

  const debouncedTerm = useDebouncedValue(term, 250)
  const { users, isFetching } = useUserSearch(debouncedTerm, open)
  const { conversations } = useConversations()
  const create = useCreateConversation()

  useEffect(() => {
    if (open) return
    setTerm('')
    setSelected([])
    setGroupTitle('')
  }, [open])

  const isGroup = selected.length > 1

  /** An existing direct chat should be opened, not duplicated. */
  const existingDirect = useMemo(() => {
    if (selected.length !== 1) return null
    const [peerId] = selected
    return conversations.find((row) => row.kind === 'direct' && row.peerId === peerId) ?? null
  }, [selected, conversations])

  const toggle = (userId: number) =>
    setSelected((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    )

  const submit = () => {
    if (selected.length === 0) return

    if (existingDirect) {
      onOpenChange(false)
      void navigate(`/chats/${existingDirect.id}`)
      return
    }

    create.mutate(
      {
        type: isGroup ? 'group' : 'direct',
        ...(isGroup ? { title: groupTitle.trim() || 'New group' } : {}),
        participant_ids: selected,
      },
      {
        onSuccess: (conversation) => {
          onOpenChange(false)
          void navigate(`/chats/${conversation.id}`)
        },
        onError: (error: Error) => toast.error('Could not start conversation', error.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Pick one person for a direct chat, or several to create a group.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="text-faint-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search people"
            className="pl-8"
            autoFocus
          />
        </div>

        {isGroup ? (
          <Input
            value={groupTitle}
            onChange={(event) => setGroupTitle(event.target.value)}
            placeholder="Group name"
            aria-label="Group name"
          />
        ) : null}

        <div className="max-h-72 min-h-40 space-y-0.5 overflow-y-auto">
          {isFetching && users.length === 0 ? (
            <div className="grid h-40 place-items-center">
              <Spinner className="text-muted-foreground size-5" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground grid h-40 place-items-center text-[13px]">
              No people found.
            </p>
          ) : (
            users.map((user) => {
              const isSelected = selected.includes(user.id)
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggle(user.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                    isSelected ? 'selection-bead' : 'hover:bg-accent/60',
                  )}
                >
                  <Avatar className="size-9">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                    <AvatarFallback>{initialsOf(user.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{user.fullName}</p>
                    <p className="text-muted-foreground truncate text-[12px]">
                      @{user.username}
                      {user.title ? ` · ${user.title}` : ''}
                    </p>
                  </div>
                  {isSelected ? <Check className="text-primary size-4" /> : null}
                </button>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={selected.length === 0 || create.isPending}>
            {create.isPending ? <Spinner /> : isGroup ? <Users className="size-4" /> : null}
            {existingDirect
              ? 'Open chat'
              : isGroup
                ? `Create group (${selected.length})`
                : 'Start chat'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
