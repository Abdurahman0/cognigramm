import { Paperclip, SendHorizontal, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Button, Spinner, Textarea, Tooltip } from '@/components/ui'
import { useEditMessage, useSendAttachment, useSendMessage } from '@/hooks/use-messages'
import { useTypingSignal } from '@/hooks/use-typing'
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

export function Composer({ conversationId, editing, onCancelEdit }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const draft = useChatStore((state) => state.draftByConversation[conversationId] ?? '')
  const setDraft = useChatStore((state) => state.setDraft)
  const replyTo = useChatStore((state) => state.replyTo)
  const setReplyTo = useChatStore((state) => state.setReplyTo)

  const [value, setValue] = useState(draft)
  const sendMessage = useSendMessage(conversationId)
  const sendAttachment = useSendAttachment(conversationId)
  const editMessage = useEditMessage()
  const { keystroke, stop } = useTypingSignal(conversationId)

  // Switching conversations swaps in that chat's draft.
  useEffect(() => {
    setValue(useChatStore.getState().draftByConversation[conversationId] ?? '')
  }, [conversationId])

  // Entering edit mode loads the existing text and focuses the caret at its end.
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
    sendAttachment.mutate(file)
  }

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
            disabled={sendAttachment.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {sendAttachment.isPending ? <Spinner /> : <Paperclip className="size-4" />}
          </Button>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) sendAttachment.mutate(file)
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

        <Tooltip content={editing ? 'Save (Enter)' : 'Send (Enter)'}>
          <Button
            size="icon"
            aria-label={editing ? 'Save message' : 'Send message'}
            disabled={!value.trim()}
            onClick={submit}
          >
            <SendHorizontal className="size-4" />
          </Button>
        </Tooltip>
      </div>
    </div>
  )
}
