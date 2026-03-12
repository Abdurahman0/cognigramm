"use client";

import { routeWebSocketEvent } from "@/websocket/eventRouter";

import { useConversationStore } from "@/store/conversationStore";
import type { SocketEnvelope, WebSocketOutgoingEvent } from "@/types/websocket";
import { WS_BASE_URL, WS_RECONNECT_DELAYS_MS } from "@/utils/constants";

type EventListener = (envelope: SocketEnvelope) => void;

interface ConnectParams {
  token: string;
  sessionId?: string | null;
  deviceId?: string | null;
}

class RealtimeSocketClient {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private sessionId: string | null = null;
  private deviceId: string | null = null;
  private reconnectAttempt = 0;
  private listeners = new Set<EventListener>();
  private pingInterval: number | null = null;
  private messageQueue: string[] = [];
  private manuallyClosed = false;

  connect(params: ConnectParams): void {
    this.token = params.token;
    this.sessionId = params.sessionId || null;
    this.deviceId = params.deviceId || null;
    this.manuallyClosed = false;
    this.openSocket();
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.clearPing();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  send<TPayload extends Record<string, unknown>>(event: WebSocketOutgoingEvent, payload: TPayload): void {
    const envelope: SocketEnvelope<TPayload> = { event, payload };
    const encoded = JSON.stringify(envelope);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(encoded);
    } else {
      this.messageQueue.push(encoded);
    }
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): "idle" | "connecting" | "connected" | "disconnected" {
    if (!this.socket) {
      return "idle";
    }
    if (this.socket.readyState === WebSocket.CONNECTING) {
      return "connecting";
    }
    if (this.socket.readyState === WebSocket.OPEN) {
      return "connected";
    }
    return "disconnected";
  }

  private openSocket(): void {
    if (!this.token) {
      return;
    }
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      return;
    }
    const url = new URL("/ws/chat", WS_BASE_URL);
    url.searchParams.set("token", this.token);
    if (this.sessionId) {
      url.searchParams.set("session_id", this.sessionId);
    }
    if (this.deviceId) {
      url.searchParams.set("device_id", this.deviceId);
    }

    this.socket = new WebSocket(url.toString());
    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.flushQueue();
      this.startPing();
    };
    this.socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as SocketEnvelope;
        routeWebSocketEvent(parsed);
        for (const listener of this.listeners) {
          listener(parsed);
        }
      } catch {
        return;
      }
    };
    this.socket.onclose = () => {
      this.clearPing();
      this.socket = null;
      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    };
    this.socket.onerror = () => {
      return;
    };
  }

  private scheduleReconnect(): void {
    const delay = WS_RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, WS_RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    window.setTimeout(() => {
      if (this.manuallyClosed) {
        return;
      }
      this.openSocket();
    }, delay);
  }

  private flushQueue(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    while (this.messageQueue.length > 0) {
      const next = this.messageQueue.shift();
      if (next) {
        this.socket.send(next);
      }
    }
  }

  private startPing(): void {
    this.clearPing();
    this.pingInterval = window.setInterval(() => {
      const activeConversationId = useConversationStore.getState().activeConversationId;
      this.send("active_conversation", { conversation_id: activeConversationId });
    }, 25000);
  }

  private clearPing(): void {
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

export const realtimeSocketClient = new RealtimeSocketClient();
