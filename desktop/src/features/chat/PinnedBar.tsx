import { Pin, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui'
import { usePinnedMessages, useTogglePin } from '@/hooks/use-messages'

/**
 * The pinned strip. With several pins it cycles through them on click, which
 * is less screen than a list and matches what people expect from Telegram.
 */
export function PinnedBar({
  conversationId,
  onJumpTo,
}: {
  conversationId: number
  onJumpTo: (messageId: number) => void
}) {
  const { data: pinned } = usePinnedMessages(conversationId)
  const togglePin = useTogglePin()
  const [index, setIndex] = useState(0)

  if (!pinned || pinned.length === 0) return null

  const current = pinned[index % pinned.length]
  if (!current) return null

  return (
    <div className="border-border/60 bg-input/60 flex items-center gap-2 border-b px-3 py-1.5">
      <Pin className="text-primary size-3.5 shrink-0" />
      <button
        type="button"
        onClick={() => {
          onJumpTo(current.id)
          setIndex((value) => value + 1)
        }}
        className="min-w-0 flex-1 text-left"
      >
        <p className="text-primary text-[11px] font-semibold">
          Pinned message
          {pinned.length > 1 ? ` ${(index % pinned.length) + 1}/${pinned.length}` : ''}
        </p>
        <p className="text-muted-foreground truncate text-[12px]">
          {current.body || current.attachments[0]?.name || 'Attachment'}
        </p>
      </button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Unpin"
        onClick={() => togglePin(current.id, true)}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )
}
