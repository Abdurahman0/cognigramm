import { USE_MOCK_API, WS_BASE_URL } from "@/services/api/config";
import { ensureAccessToken, notifySessionLost } from "@/services/api/session";
import type { ApiSocketEnvelope } from "@/services/api";

export type SocketStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

export type SocketOutgoingEvent =
  | "send_message"
  | "delivery_ack"
  | "read_receipt"
  | "typing_start"
  | "typing_stop"
  | "typing"
  | "edit_message"
  | "delete_message"
  | "join_conversation"
  | "leave_conversation"
  | "active_conversation"
  | "sync_missed"
  | "pin_message"
  | "unpin_message"
  | "call_invite"
  | "call_accept"
  | "call_reject"
  | "call_end"
  | "call_signal";

interface ConnectOptions {
  token: string;
  sessionId?: string | null;
  deviceId?: string | null;
  onEvent: (envelope: ApiSocketEnvelope) => void;
  onStatusChange?: (status: SocketStatus) => void;
  getActiveConversationId?: () => number | null;
}

const RECONNECT_DELAYS_MS = [500, 1_000, 2_000, 4_000, 8_000, 12_000];

/** Close code the server uses when the device session is revoked or expired. */
const CLOSE_SESSION_REVOKED = 4001;

class RealtimeSocketClient {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private sessionId: string | null = null;
  private deviceId: string | null = null;
  private reconnectAttempt = 0;
  private manuallyClosed = false;
  private status: SocketStatus = "idle";
  private queue: string[] = [];
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onEvent: ((envelope: ApiSocketEnvelope) => void) | null = null;
  private onStatusChange: ((status: SocketStatus) => void) | undefined;
  private getActiveConversationId: (() => number | null) | undefined;

  connect(options: ConnectOptions): void {
    this.token = options.token;
    this.sessionId = options.sessionId ?? null;
    this.deviceId = options.deviceId ?? null;
    this.onEvent = options.onEvent;
    this.onStatusChange = options.onStatusChange;
    this.getActiveConversationId = options.getActiveConversationId;
    this.manuallyClosed = false;
    void this.openSocket();
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.clearReconnectTimer();
    this.clearPing();
    this.queue = [];
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.setStatus("disconnected");
  }

  getStatus(): SocketStatus {
    return this.status;
  }

  send<TPayload extends Record<string, unknown>>(event: SocketOutgoingEvent, payload: TPayload): void {
    const encoded = JSON.stringify({ event, payload });
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(encoded);
      return;
    }
    this.queue.push(encoded);
  }

  private async openSocket(): Promise<void> {
    if (!this.token) {
      return;
    }
    // Against the in-app mock there is no server to reach. Reporting connected keeps the
    // UI out of a permanent reconnect loop; nothing is pushed, and the REST-shaped mock
    // is where all the data comes from.
    if (USE_MOCK_API) {
      this.setStatus("connected");
      return;
    }
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      return;
    }

    // The URL carries an access token, and those expire every 15 minutes. An
    // established socket survives expiry; a new one opened with a stale token
    // is rejected, so the current token is fetched at connect time.
    const liveToken = (await ensureAccessToken()) ?? this.token;
    this.token = liveToken;

    const base = WS_BASE_URL.replace(/\/+$/, "");
    let url = `${base}/ws/chat?token=${encodeURIComponent(liveToken)}`;
    if (this.sessionId) {
      url += `&session_id=${encodeURIComponent(this.sessionId)}`;
    }
    if (this.deviceId) {
      url += `&device_id=${encodeURIComponent(this.deviceId)}`;
    }

    this.setStatus(this.reconnectAttempt > 0 ? "reconnecting" : "connecting");

    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.clearReconnectTimer();
      this.flushQueue();
      this.setStatus("connected");
      this.startPing();
      this.sendActiveConversation();
    };

    this.socket.onmessage = (event) => {
      try {
        const envelope = JSON.parse(String(event.data)) as ApiSocketEnvelope;
        this.onEvent?.(envelope);
      } catch {
        return;
      }
    };

    this.socket.onclose = (event: { code?: number; reason?: string }) => {
      this.clearPing();
      this.socket = null;

      if (event?.code === CLOSE_SESSION_REVOKED) {
        // Signed out on this device, or the session expired. Reconnecting
        // would fail forever; the app has to go back to the sign-in screen.
        this.manuallyClosed = true;
        this.setStatus("disconnected");
        notifySessionLost(event.reason || "Signed out on this device");
        return;
      }

      if (this.manuallyClosed) {
        this.setStatus("disconnected");
        return;
      }
      this.scheduleReconnect();
    };

    this.socket.onerror = () => {
      this.setStatus("error");
    };
  }

  private flushQueue(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) {
        continue;
      }
      this.socket.send(next);
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const base = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)] ?? 12_000;
    // Full jitter: without it every client dropped by the same server blip
    // comes back in the same millisecond.
    const delay = base / 2 + Math.random() * (base / 2);
    this.reconnectAttempt += 1;
    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      if (this.manuallyClosed) {
        return;
      }
      void this.openSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startPing(): void {
    this.clearPing();
    this.pingTimer = setInterval(() => {
      this.sendActiveConversation();
    }, 25_000);
  }

  private clearPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendActiveConversation(): void {
    const conversationId = this.getActiveConversationId?.() ?? null;
    this.send("active_conversation", {
      conversation_id: conversationId
    });
  }

  private setStatus(status: SocketStatus): void {
    this.status = status;
    this.onStatusChange?.(status);
  }
}

export const realtimeSocketClient = new RealtimeSocketClient();
