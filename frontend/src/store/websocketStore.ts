"use client";

import { create } from "zustand";

type WebSocketStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

interface WebSocketState {
  status: WebSocketStatus;
  reconnectAttempt: number;
  setStatus: (status: WebSocketStatus) => void;
  setReconnectAttempt: (attempt: number) => void;
}

export const useWebSocketStore = create<WebSocketState>((set) => ({
  status: "idle",
  reconnectAttempt: 0,
  setStatus: (status) => set({ status }),
  setReconnectAttempt: (reconnectAttempt) => set({ reconnectAttempt })
}));
