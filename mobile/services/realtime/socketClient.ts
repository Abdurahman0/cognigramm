import { WS_BASE_URL } from "@/services/api/config";
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
    this.openSocket();
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

  private openSocket(): void {
    if (!this.token) {
      return;
    }
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      return;
    }

    const base = WS_BASE_URL.replace(/\/+$/, "");
    let url = `${base}/ws/chat?token=${encodeURIComponent(this.token)}`;
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

    this.socket.onclose = () => {
      this.clearPing();
      this.socket = null;
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
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      if (this.manuallyClosed) {
        return;
      }
      this.openSocket();
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
