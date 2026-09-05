import { Mic, Paperclip, SendHorizontal, Trash2, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Button, Spinner, Textarea, Tooltip, toast } from '@/components/ui'
import { MIN_DURATION_MS, useVoiceRecorder } from '@/features/chat/use-voice-recorder'
import { useEditMessage, useSendFile, useSendMessage } from '@/hooks/use-messages'
import { useTypingSignal } from '@/hooks/use-typing'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/chat'
import type { Message } from '@/types'

/** Grows to this many pixels, then scrolls internally. */
const MAX_TEXTAREA_HEIGHT = 168

interface ComposerProps {
  conversationId: number
  /** Set while an existing message is being rewritten. */
  editing: Message | null
  onCancelEdit: () => void
}

/** The live meter drawn while recording, newest sample on the right. */
function LevelMeter({ levels }: { levels: number[] }) {
  return (
    <div className="flex h-6 flex-1 items-center gap-[2px] overflow-hidden">
      {levels.map((level, index) => (
        <span
          key={index}
          className="bg-destructive w-[3px] shrink-0 rounded-full"
          style={{ height: `${Math.max(10, Math.min(100, level * 160))}%` }}
        />
      ))}
    </div>
  )
}

export function Composer({ conversationId, editing, onCancelEdit }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const setDraft = useChatStore((state) => state.setDraft)
  const replyTo = useChatStore((state) => state.replyTo)
  const setReplyTo = useChatStore((state) => state.setReplyTo)

  const [value, setValue] = useState('')
  const sendMessage = useSendMessage(conversationId)
  const sendFile = useSendFile(conversationId)
  const editMessage = useEditMessage()
  const { keystroke, stop } = useTypingSignal(conversationId)
  const recorder = useVoiceRecorder()

  // Switching conversations swaps in that chat's draft.
  useEffect(() => {
    setValue(useChatStore.getState().draftByConversation[conversationId] ?? '')
  }, [conversationId])

  // Entering edit mode loads the existing text and puts the caret at its end.
  useEffect(() => {
    if (!editing) return
    setValue(editing.body)
    const element = textareaRef.current
    if (element) {
      element.focus()
      requestAnimationFrame(() =>
        element.setSelectionRange(element.value.length, element.value.length),
      )
    }
  }, [editing])

  useLayoutEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [value])

  useEffect(() => {
    if (recorder.error) toast.error('Cannot record', recorder.error)
  }, [recorder.error])

  const activeReply = replyTo?.conversationId === conversationId ? replyTo : null

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return

    if (editing) {
      if (trimmed !== editing.body) editMessage(editing.id, trimmed)
      onCancelEdit()
    } else {
      sendMessage({ content: trimmed, replyToMessageId: activeReply?.messageId ?? null })
      setReplyTo(null)
    }

    setValue('')
    setDraft(conversationId, '')
    stop()
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handleChange = (next: string) => {
    setValue(next)
    setDraft(conversationId, next)
    if (next.trim()) keystroke()
    else stop()
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.clipboardData.files)[0]
    if (!file) return
    event.preventDefault()
    sendFile.mutate({ file })
  }

  const finishRecording = async () => {
    const recording = await recorder.finish()
    if (!recording) {
      toast.info('Too short', 'Hold the recording for at least a second.')
      return
    }
    sendFile.mutate({
      file: recording.file,
      kind: 'voice',
      // The server stores bytes and derives nothing, so the shape of the
      // waveform and its length have to travel with the message.
      metadata: {
        duration_ms: recording.durationMs,
        waveform: recording.waveform,
        codec: recording.mimeType,
      },
    })
  }

  if (recorder.isRecording || recorder.state === 'processing') {
    const tooShort = recorder.durationMs < MIN_DURATION_MS
    return (
      <div className="shrink-0 px-3 pb-3">
        <div className="glass-floating flex items-center gap-3 rounded-2xl p-2.5">
          <span className="bg-destructive size-2.5 shrink-0 animate-pulse rounded-full" />
          <span className="shrink-0 text-[13px] font-medium tabular-nums">
            {formatDuration(recorder.durationMs)}
          </span>
          <LevelMeter levels={recorder.levels} />
          <Tooltip content="Discard">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Discard recording"
              onClick={recorder.cancel}
            >
              <Trash2 className="size-4" />
            </Button>
          </Tooltip>
          <Tooltip content="Send voice message">
            <Button
              size="icon"
              aria-label="Send voice message"
              disabled={tooShort || recorder.state === 'processing'}
              onClick={() => void finishRecording()}
            >
              {recorder.state === 'processing' ? (
                <Spinner />
              ) : (
                <SendHorizontal className="size-4" />
              )}
            </Button>
          </Tooltip>
        </div>
      </div>
    )
  }

  const hasText = value.trim().length > 0

  return (
    <div className="shrink-0 px-3 pb-3">
      {activeReply || editing ? (
        <div className="border-primary bg-input mb-1.5 flex items-center gap-2 rounded-t-xl border-l-2 px-3 py-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-primary text-[11px] font-semibold">
              {editing ? 'Editing message' : 'Replying to'}
            </p>
            <p className="text-muted-foreground truncate text-[12px]">
              {editing ? editing.body : activeReply?.preview}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cancel"
            onClick={() => {
              if (editing) {
                onCancelEdit()
                setValue('')
                setDraft(conversationId, '')
              } else {
                setReplyTo(null)
              }
            }}
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-full p-1"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      <div className="glass-floating flex items-end gap-1.5 rounded-2xl p-1.5">
        <Tooltip content="Attach file">
          <Button
            size="icon"
            variant="ghost"
            aria-label="Attach file"
            disabled={sendFile.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {sendFile.isPending ? <Spinner /> : <Paperclip className="size-4" />}
          </Button>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) sendFile.mutate({ file })
            event.target.value = ''
          }}
        />

        <Textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          onPaste={handlePaste}
          onKeyDown={(event) => {
            // Enter sends; Shift+Enter is a newline. Escape leaves edit mode.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            } else if (event.key === 'Escape' && editing) {
              onCancelEdit()
              setValue('')
            }
          }}
          placeholder={editing ? 'Edit message…' : 'Write a message…'}
          className="max-h-[168px] min-h-9 flex-1 py-2"
          aria-label="Message"
        />

        {/* The send button turns into a microphone when there is nothing to
            send, which is where a messenger user expects to find it. */}
        {hasText || editing ? (
          <Tooltip content={editing ? 'Save (Enter)' : 'Send (Enter)'}>
            <Button
              size="icon"
              aria-label={editing ? 'Save message' : 'Send message'}
              onClick={submit}
            >
              <SendHorizontal className="size-4" />
            </Button>
          </Tooltip>
        ) : (
          <Tooltip content="Record voice message">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Record voice message"
              disabled={recorder.state === 'requesting'}
              onClick={() => void recorder.start()}
              className={cn(recorder.state === 'requesting' && 'opacity-60')}
            >
              {recorder.state === 'requesting' ? <Spinner /> : <Mic className="size-4" />}
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
