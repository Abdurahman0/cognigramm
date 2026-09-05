import { useCallback, useEffect, useRef } from 'react'

import { realtime } from '@/realtime/socket'

/** Repeat interval while the user keeps typing; the server expires state faster. */
const REFRESH_MS = 3_000
/** Silence after which the client stops on its own. */
const IDLE_MS = 2_500

/**
 * Typing notifications for one conversation.
 *
 * Sending a frame per keystroke would be both wasteful and rate-limited, so
 * this sends one `typing_start`, refreshes it while typing continues, and
 * always emits `typing_stop` — on idle, on send, and on unmount.
 */
export function useTypingSignal(conversationId: number | null) {
  const activeRef = useRef(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current)
    if (refreshTimer.current) clearInterval(refreshTimer.current)
    idleTimer.current = null
    refreshTimer.current = null
    if (!activeRef.current || conversationId === null) return
    activeRef.current = false
    realtime.send('typing_stop', { conversation_id: conversationId })
  }, [conversationId])

  const keystroke = useCallback(() => {
    if (conversationId === null) return

    if (!activeRef.current) {
      activeRef.current = true
      realtime.send('typing_start', { conversation_id: conversationId })
      refreshTimer.current = setInterval(() => {
        realtime.send('typing_start', { conversation_id: conversationId })
      }, REFRESH_MS)
    }

    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(stop, IDLE_MS)
  }, [conversationId, stop])

  // Leaving the chat mid-sentence must not strand the indicator on everyone
  // else's screen.
  useEffect(() => stop, [stop])

  return { keystroke, stop }
}
