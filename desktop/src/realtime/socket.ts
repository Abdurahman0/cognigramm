import { WS_CHAT_URL } from '@/lib/config'
import type { OutgoingEvent, ServerEventMap } from '@/realtime/events'

export type SocketStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error'

type Handler<TPayload> = (payload: TPayload) => void

interface ConnectOptions {
  token: string
  sessionId?: string
  deviceId?: string
}

/** Full jitter would be overkill for one client; these are the plain steps. */
const BACKOFF_MS = [500, 1_000, 2_000, 4_000, 8_000, 12_000, 20_000]

/** The server treats any frame as liveness; this doubles as a presence refresh. */
const HEARTBEAT_MS = 25_000

/**
 * The single chat socket.
 *
 * Deliberately a plain class, not a hook: the connection has to outlive any
 * component, survive route changes, and stay unique across React 18's double
 * mount in development. React talks to it through `RealtimeProvider`.
 */
class RealtimeSocket {
  private socket: WebSocket | null = null
  private token: string | null = null
  private sessionId: string | undefined
  private deviceId: string | undefined
  private status: SocketStatus = 'idle'
  private attempt = 0
  private closedByUs = false
  private outbox: string[] = []
  private heartbeat: ReturnType<typeof setInterval> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  private handlers = new Map<string, Set<Handler<never>>>()
  private statusHandlers = new Set<Handler<SocketStatus>>()

  /** Rooms the client asked to be in, replayed after every reconnect. */
  private rooms = new Set<number>()
  private activeConversationId: number | null = null

  connect({ token, sessionId, deviceId }: ConnectOptions): void {
    this.token = token
    this.sessionId = sessionId
    this.deviceId = deviceId
    this.closedByUs = false
    this.attempt = 0
    this.open()
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

  private open(): void {
    if (!this.token) return
    if (this.socket?.readyState === WebSocket.CONNECTING) return
    if (this.socket?.readyState === WebSocket.OPEN) return

    const params = new URLSearchParams({ token: this.token })
    if (this.sessionId) params.set('session_id', this.sessionId)
    if (this.deviceId) params.set('device_id', this.deviceId)

    this.setStatus(this.attempt > 0 ? 'reconnecting' : 'connecting')
    const socket = new WebSocket(`${WS_CHAT_URL}?${params.toString()}`)
    this.socket = socket

    socket.onopen = () => {
      this.attempt = 0
      this.clearRetry()
      this.setStatus('connected')
      // Re-establish server-side state before flushing anything the user typed
      // while offline, so those messages land in a room the server knows about.
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

    socket.onclose = () => {
      this.clearHeartbeat()
      this.socket = null
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
    const delay = BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)] ?? 20_000
    this.attempt += 1
    this.setStatus('reconnecting')
    this.retryTimer = setTimeout(() => {
      if (!this.closedByUs) this.open()
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
