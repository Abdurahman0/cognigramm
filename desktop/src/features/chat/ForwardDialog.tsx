import { CornerUpRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'

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
  initialsOf,
  toast,
} from '@/components/ui'
import { useConversations } from '@/hooks/use-conversations'
import { useForwardMessage } from '@/hooks/use-messages'
import { useDirectory } from '@/hooks/use-users'
import { previewOf } from '@/hooks/use-last-message'
import { cn } from '@/lib/utils'
import type { Message } from '@/types'

interface ForwardDialogProps {
  message: Message | null
  onClose: () => void
}

/** Picks a destination for a message and forwards it there. */
export function ForwardDialog({ message, onClose }: ForwardDialogProps) {
  const [term, setTerm] = useState('')
  const [target, setTarget] = useState<number | null>(null)
  const { conversations } = useConversations()
  const { byId } = useDirectory()
  const forward = useForwardMessage()

  const options = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return conversations
      .filter((conversation) => conversation.id !== message?.conversationId)
      .filter((conversation) => {
        if (!needle) return true
        const peer = conversation.peerId ? byId.get(conversation.peerId) : undefined
        return `${conversation.title} ${peer?.fullName ?? ''}`.toLowerCase().includes(needle)
      })
  }, [conversations, term, byId, message?.conversationId])

  const submit = () => {
    if (!message || target === null) return
    forward(message, target)
    const destination = conversations.find((conversation) => conversation.id === target)
    toast.success('Forwarded', destination ? `Sent to ${destination.title}` : undefined)
    setTarget(null)
    setTerm('')
    onClose()
  }

  return (
    <Dialog open={Boolean(message)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
          <DialogDescription className="truncate">{previewOf(message)}</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="text-faint-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search conversations"
            className="pl-8"
            autoFocus
          />
        </div>

        <div className="max-h-64 min-h-32 space-y-0.5 overflow-y-auto">
          {options.length === 0 ? (
            <p className="text-muted-foreground grid h-32 place-items-center text-[13px]">
              No other conversations.
            </p>
          ) : (
            options.map((conversation) => {
              const peer = conversation.peerId ? byId.get(conversation.peerId) : undefined
              const title = peer?.fullName ?? conversation.title
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setTarget(conversation.id)}
                  aria-pressed={target === conversation.id}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                    target === conversation.id ? 'selection-bead' : 'hover:bg-accent/60',
                  )}
                >
                  <Avatar className="size-9">
                    {peer?.avatarUrl ? <AvatarImage src={peer.avatarUrl} alt="" /> : null}
                    <AvatarFallback>{initialsOf(title)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
                </button>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={target === null}>
            <CornerUpRight className="size-4" /> Forward
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
