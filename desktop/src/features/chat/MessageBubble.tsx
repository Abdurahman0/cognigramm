import { Copy, CornerUpRight, MoreVertical, Pencil, Pin, PinOff, Reply, Trash2 } from 'lucide-react'
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
import { VideoNoteBubble } from '@/features/chat/VideoNoteBubble'
import { VoiceMessage } from '@/features/chat/VoiceMessage'
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
  onForward: (message: Message) => void
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
  onForward,
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

  const isVideoNote = message.kind === 'video_note' && message.attachments.length > 0
  const hasText = !message.isDeleted && Boolean(message.body)

  // Enough room for "23:59" plus a tick, and a little more when the message
  // also carries a pin or an "edited" mark.
  const metaWidth = (isMine ? 46 : 34) + (message.isPinned ? 12 : 0) + (message.editedAt ? 34 : 0)

  const mediaOnly =
    message.attachments.length > 0 &&
    !message.body &&
    !message.forwardedFromMessageId &&
    message.kind !== 'voice' &&
    !isVideoNote &&
    !(showAuthor && !isMine && isGroupStart)

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
          // A readable line is about fifty characters; past that the eye has to
          // hunt for the start of the next one.
          'rounded-bubble relative max-w-[min(52ch,68%)] text-[14px] leading-relaxed',
          // A picture with no caption fills its bubble; a wide blue frame
          // around a photo reads as a mistake rather than a design.
          mediaOnly ? 'p-1' : 'px-3 py-1.5',
          isMine
            ? 'bg-bubble-mine text-bubble-mine-foreground'
            : 'bg-bubble-other text-bubble-other-foreground shadow-[inset_0_0_0_0.5px_var(--bubble-other-rim)]',
          // Last, so it wins: a round note is its own shape, and a bubble
          // behind it shows as four corners poking out from under the circle.
          isVideoNote && 'bg-transparent p-0',
          // The first message of a run points at its author; the rest align
          // under it, which is what makes a run read as one turn.
          isGroupStart &&
            (isMine ? 'rounded-tr-[--radius-bubble-tail]' : 'rounded-tl-[--radius-bubble-tail]'),
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

        {message.forwardedFromMessageId ? (
          <p className="mb-1 flex items-center gap-1 text-[11px] font-medium opacity-75">
            <CornerUpRight className="size-3" /> Forwarded
          </p>
        ) : null}

        {message.attachments.length > 0 ? (
          <div
            className={cn(
              'space-y-1.5',
              message.body && 'mb-1.5',
              mediaOnly && 'overflow-hidden rounded-xl',
            )}
          >
            {message.attachments.map((attachment) => {
              // Keyed by object key, not by attachment id: the id changes from
              // a placeholder to the real one when the server echoes the
              // message, and a changing key would remount the player and stop
              // a voice message mid-playback.
              const key = attachment.objectKey || `${attachment.id}-${attachment.name}`
              // A voice message is a player and a video note is a circle;
              // neither belongs in the generic attachment row.
              if (message.kind === 'video_note') {
                return <VideoNoteBubble key={key} attachment={attachment} />
              }
              return message.kind === 'voice' || attachment.mimeType.startsWith('audio/') ? (
                <VoiceMessage key={key} attachment={attachment} mine={isMine} />
              ) : (
                <AttachmentView key={key} attachment={attachment} />
              )
            })}
          </div>
        ) : null}

        {message.isDeleted ? (
          <p className="text-[13px] italic opacity-70">This message was deleted</p>
        ) : message.body ? (
          <p data-selectable className="break-words whitespace-pre-wrap">
            {message.body}
            {/* Holds a gap at the end of the last line for the clock to sit in.
                Without it the time takes a line of its own, and a one-word
                message ends up as tall as a paragraph. */}
            <span aria-hidden className="inline-block" style={{ width: metaWidth }} />
          </p>
        ) : null}

        <div
          className={cn(
            'flex items-center justify-end gap-1 text-[10px] leading-none',
            hasText && 'absolute right-2.5 bottom-1.5',
            // Over an image the timestamp needs its own backing to stay legible.
            mediaOnly
              ? 'absolute right-2 bottom-2 rounded-full bg-black/45 px-1.5 py-0.5 text-white'
              : '',
            // A video note has no coloured bubble behind it, so the white
            // meta text of an outgoing message would vanish on a light theme.
            !mediaOnly && (isMine && !isVideoNote ? 'text-white/75' : 'text-muted-foreground'),
            // Only the row form needs the gap above; the floating one sits in
            // the space the text already reserved.
            !mediaOnly && !hasText && 'mt-0.5',
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
              <DropdownMenuItem onSelect={() => onForward(message)}>
                <CornerUpRight /> Forward
              </DropdownMenuItem>
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
    a.forwardedFromMessageId === b.forwardedFromMessageId &&
    previous.isGroupStart === next.isGroupStart &&
    previous.showAuthor === next.showAuthor &&
    previous.sender === next.sender &&
    previous.replyTo?.id === next.replyTo?.id
  )
})
