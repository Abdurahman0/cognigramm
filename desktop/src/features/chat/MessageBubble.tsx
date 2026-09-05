import { Copy, MoreVertical, Pencil, Pin, PinOff, Reply, Trash2 } from 'lucide-react'
import { memo } from 'react'

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  initialsOf,
  toast,
} from '@/components/ui'
import { AttachmentView } from '@/features/chat/AttachmentView'
import { DeliveryTicks } from '@/features/chat/DeliveryTicks'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Message, User } from '@/types'

interface MessageBubbleProps {
  message: Message
  isMine: boolean
  sender: User | undefined
  /** Groups need a name and avatar; a direct chat has only two people in it. */
  showAuthor: boolean
  /** First of a run from the same sender — only that one gets the tail and avatar. */
  isGroupStart: boolean
  replyTo: Message | undefined
  onReply: (message: Message) => void
  onEdit: (message: Message) => void
  onDelete: (message: Message) => void
  onTogglePin: (message: Message) => void
  onJumpTo: (messageId: number) => void
}

function MessageBubbleBase({
  message,
  isMine,
  sender,
  showAuthor,
  isGroupStart,
  replyTo,
  onReply,
  onEdit,
  onDelete,
  onTogglePin,
  onJumpTo,
}: MessageBubbleProps) {
  if (message.kind === 'system') {
    return (
      <div className="my-2 flex justify-center">
        <span className="text-muted-foreground rounded-full bg-black/15 px-3 py-1 text-[12px]">
          {message.body}
        </span>
      </div>
    )
  }

  const copy = () => {
    void navigator.clipboard.writeText(message.body)
    toast.success('Copied')
  }

  return (
    <div
      data-message-id={message.id}
      className={cn(
        'group flex w-full gap-2 px-3',
        isMine ? 'flex-row-reverse' : 'flex-row',
        isGroupStart ? 'mt-2' : 'mt-0.5',
      )}
    >
      {showAuthor && !isMine ? (
        <div className="w-8 shrink-0 self-end">
          {isGroupStart ? (
            <Avatar className="size-8">
              {sender?.avatarUrl ? <AvatarImage src={sender.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-[11px]">
                {initialsOf(sender?.fullName ?? message.senderName ?? '?')}
              </AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          'relative max-w-[min(68ch,72%)] rounded-2xl px-3 py-2 text-[14px] leading-snug',
          isMine
            ? 'bg-bubble-mine text-bubble-mine-foreground'
            : 'bg-bubble-other text-bubble-other-foreground',
          isGroupStart && (isMine ? 'rounded-tr-md' : 'rounded-tl-md'),
          message.delivery === 'failed' && 'ring-destructive ring-1',
          message.pending && 'opacity-80',
        )}
      >
        {showAuthor && !isMine && isGroupStart ? (
          <p className="text-primary mb-0.5 text-[12px] font-semibold">
            {sender?.fullName ?? message.senderName}
          </p>
        ) : null}

        {replyTo ? (
          <button
            type="button"
            onClick={() => onJumpTo(replyTo.id)}
            className="mb-1.5 flex w-full flex-col rounded-md border-l-2 border-current/60 bg-black/10 px-2 py-1 text-left"
          >
            <span className="text-[11px] font-semibold opacity-90">
              {replyTo.senderName ?? 'Message'}
            </span>
            <span className="line-clamp-2 text-[12px] opacity-80">
              {replyTo.body || replyTo.attachments[0]?.name || 'Attachment'}
            </span>
          </button>
        ) : null}

        {message.attachments.length > 0 ? (
          <div className={cn('space-y-1.5', message.body && 'mb-1.5')}>
            {message.attachments.map((attachment) => (
              <AttachmentView key={`${attachment.id}-${attachment.name}`} attachment={attachment} />
            ))}
          </div>
        ) : null}

        {message.isDeleted ? (
          <p className="text-[13px] italic opacity-70">This message was deleted</p>
        ) : message.body ? (
          <p data-selectable className="break-words whitespace-pre-wrap">
            {message.body}
          </p>
        ) : null}

        <div
          className={cn(
            'mt-0.5 flex items-center justify-end gap-1 text-[10px]',
            isMine ? 'text-white/70' : 'text-muted-foreground',
          )}
        >
          {message.isPinned ? <Pin className="size-3" aria-label="Pinned" /> : null}
          {message.editedAt ? <span>edited</span> : null}
          <span className="tabular-nums">{formatTime(message.createdAt)}</span>
          {isMine ? <DeliveryTicks state={message.delivery} /> : null}
        </div>

        {message.error ? (
          <p className="text-destructive mt-1 text-[11px]">{message.error}</p>
        ) : null}
      </div>

      {!message.isDeleted ? (
        <div className="self-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Message actions"
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full p-1"
              >
                <MoreVertical className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isMine ? 'end' : 'start'}>
              <DropdownMenuItem onSelect={() => onReply(message)}>
                <Reply /> Reply
              </DropdownMenuItem>
              {message.body ? (
                <DropdownMenuItem onSelect={copy}>
                  <Copy /> Copy text
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => onTogglePin(message)}>
                {message.isPinned ? <PinOff /> : <Pin />}
                {message.isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              {isMine ? (
                <>
                  <DropdownMenuSeparator />
                  {message.body ? (
                    <DropdownMenuItem onSelect={() => onEdit(message)}>
                      <Pencil /> Edit
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(message)}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  )
}

/**
 * A transcript re-renders on every delivery tick and typing frame; memoising
 * on the fields that actually change keeps that to the one bubble affected.
 */
export const MessageBubble = memo(MessageBubbleBase, (previous, next) => {
  const a = previous.message
  const b = next.message
  return (
    a.id === b.id &&
    a.body === b.body &&
    a.delivery === b.delivery &&
    a.isPinned === b.isPinned &&
    a.isDeleted === b.isDeleted &&
    a.editedAt === b.editedAt &&
    a.pending === b.pending &&
    a.error === b.error &&
    a.attachments.length === b.attachments.length &&
    previous.isGroupStart === next.isGroupStart &&
    previous.showAuthor === next.showAuthor &&
    previous.sender === next.sender &&
    previous.replyTo?.id === next.replyTo?.id
  )
})
