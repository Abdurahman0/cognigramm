import { notifySessionLost } from '@/api/session'
import { WS_CHAT_URL } from '@/lib/config'
import type { OutgoingEvent, ServerEventMap } from '@/realtime/events'

export type SocketStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

type Handler<TPayload> = (payload: TPayload) => void

interface ConnectOptions {
  /** Resolves a *current* access token; tokens expire every 15 minutes. */
  getToken: () => Promise<string | null>
  /** Presence session id — deliberately not the auth session id. */
  sessionId?: string
  deviceId?: string
}

/** Base delays; each is jittered so reconnecting clients do not synchronise. */
const BACKOFF_MS = [500, 1_000, 2_000, 4_000, 8_000, 12_000, 20_000]

/** The server treats any frame as liveness; this doubles as a presence refresh. */
const HEARTBEAT_MS = 25_000

/** Close code the server uses when the device session is revoked or expired. */
const CLOSE_SESSION_REVOKED = 4001

/**
 * The single chat socket.
 *
 * Deliberately a plain class, not a hook: the connection has to outlive any
 * component, survive route changes, and stay unique across React's double
 * mount in development. React talks to it through `RealtimeProvider`.
 */
class RealtimeSocket {
  private socket: WebSocket | null = null
  private getToken: ConnectOptions['getToken'] | null = null
  private sessionId: string | undefined
  private deviceId: string | undefined
  private status: SocketStatus = 'idle'
  private attempt = 0
  private closedByUs = false
  private opening = false
  private outbox: string[] = []
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  private handlers = new Map<string, Set<Handler<never>>>()
  private statusHandlers = new Set<Handler<SocketStatus>>()
  private reconnectHandlers = new Set<() => void>()

  /** Rooms the client asked to be in, replayed after every reconnect. */
  private rooms = new Set<number>()
  private activeConversationId: number | null = null

  connect({ getToken, sessionId, deviceId }: ConnectOptions): void {
    this.getToken = getToken
    this.sessionId = sessionId
    this.deviceId = deviceId
    this.closedByUs = false
    this.attempt = 0
    void this.open()
  }

  disconnect(): void {
    this.closedByUs = true
    this.clearRetry()
    this.clearHeartbeat()
    this.outbox = []
    this.rooms.clear()
    this.activeConversationId = null
    if (this.socket) {
      this.socket.onclose = null
      this.socket.close()
      this.socket = null
    }
    this.setStatus('disconnected')
  }

  getStatus(): SocketStatus {
    return this.status
  }

  send(event: OutgoingEvent, payload: Record<string, unknown> = {}): void {
    const frame = JSON.stringify({ event, payload })
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(frame)
      return
    }
    // Anything sent while reconnecting is replayed on open rather than dropped;
    // a message typed during a blip should still leave.
    this.outbox.push(frame)
  }

  on<TEvent extends keyof ServerEventMap>(
    event: TEvent,
    handler: Handler<ServerEventMap[TEvent]>,
  ): () => void {
    const set = this.handlers.get(event as string) ?? new Set()
    set.add(handler as Handler<never>)
    this.handlers.set(event as string, set)
    return () => {
      set.delete(handler as Handler<never>)
    }
  }

  onStatus(handler: Handler<SocketStatus>): () => void {
    this.statusHandlers.add(handler)
    handler(this.status)
    return () => {
      this.statusHandlers.delete(handler)
    }
  }

  /**
   * Fires after a connection is re-established, which is the client's cue to
   * replay the change cursor and recover anything the socket missed.
   */
  onReconnected(handler: () => void): () => void {
    this.reconnectHandlers.add(handler)
    return () => {
      this.reconnectHandlers.delete(handler)
    }
  }

  joinConversation(conversationId: number): void {
    this.rooms.add(conversationId)
    this.send('join_conversation', { conversation_id: conversationId })
  }

  leaveConversation(conversationId: number): void {
    this.rooms.delete(conversationId)
    this.send('leave_conversation', { conversation_id: conversationId })
  }

  setActiveConversation(conversationId: number | null): void {
    this.activeConversationId = conversationId
    this.send('active_conversation', { conversation_id: conversationId })
  }

  private async open(): Promise<void> {
    if (!this.getToken || this.opening) return
    if (this.socket?.readyState === WebSocket.CONNECTING) return
    if (this.socket?.readyState === WebSocket.OPEN) return

    this.opening = true
    this.setStatus(this.attempt > 0 ? 'reconnecting' : 'connecting')

    // The URL carries the access token, so it has to be a live one — an
    // established socket survives expiry, but a new one is rejected.
    let token: string | null
    try {
      token = await this.getToken()
    } catch {
      token = null
    } finally {
      this.opening = false
    }

    if (this.closedByUs) return
    if (!token) {
      // No usable token: either the session is gone (in which case the auth
      // layer has already reacted) or the network is down. Back off and retry.
      this.scheduleRetry()
      return
    }

    const params = new URLSearchParams({ token })
    if (this.sessionId) params.set('session_id', this.sessionId)
    if (this.deviceId) params.set('device_id', this.deviceId)

    const wasReconnect = this.attempt > 0
    const socket = new WebSocket(`${WS_CHAT_URL}?${params.toString()}`)
    this.socket = socket

    socket.onopen = () => {
      this.attempt = 0
      this.clearRetry()
      this.setStatus('connected')
      // Re-establish server-side state before flushing anything typed while
      // offline, so those messages land in a room the server knows about.
      for (const room of this.rooms) {
        socket.send(
          JSON.stringify({ event: 'join_conversation', payload: { conversation_id: room } }),
        )
      }
      socket.send(
        JSON.stringify({
          event: 'active_conversation',
          payload: { conversation_id: this.activeConversationId },
        }),
      )
      this.flush()
      this.startHeartbeat()
      if (wasReconnect) {
        for (const handler of this.reconnectHandlers) handler()
      }
    }

    socket.onmessage = (event) => {
      let envelope: { event?: string; payload?: unknown }
      try {
        envelope = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (!envelope.event) return
      this.emit(envelope.event, envelope.payload)
    }

    socket.onerror = () => {
      this.setStatus('error')
    }

    socket.onclose = (event) => {
      this.clearHeartbeat()
      this.socket = null

      if (event.code === CLOSE_SESSION_REVOKED) {
        // The device was signed out elsewhere, or the session expired.
        // Reconnecting would fail forever; the app must go back to login.
        this.closedByUs = true
        this.setStatus('disconnected')
        notifySessionLost(event.reason || 'Signed out on this device')
        return
      }

      if (this.closedByUs) {
        this.setStatus('disconnected')
        return
      }
      this.scheduleRetry()
    }
  }

  private emit(event: string, payload: unknown): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const handler of set) {
      ;(handler as Handler<unknown>)(payload)
    }
  }

  private flush(): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    const pending = this.outbox
    this.outbox = []
    for (const frame of pending) this.socket.send(frame)
  }

  private scheduleRetry(): void {
    this.clearRetry()
    const base = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)] ?? 20_000
    // Full jitter: without it every client that dropped on the same server
    // blip comes back in the same millisecond.
    const delay = base / 2 + Math.random() * (base / 2)
    this.attempt += 1
    this.setStatus('reconnecting')
    this.retryTimer = setTimeout(() => {
      if (!this.closedByUs) void this.open()
    }, delay)
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeat()
    this.heartbeat = setInterval(() => {
      this.send('active_conversation', { conversation_id: this.activeConversationId })
    }, HEARTBEAT_MS)
  }

  private clearHeartbeat(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
  }

  private setStatus(status: SocketStatus): void {
    if (this.status === status) return
    this.status = status
    for (const handler of this.statusHandlers) handler(status)
  }
}

export const realtime = new RealtimeSocket()
export type { RealtimeSocket }
