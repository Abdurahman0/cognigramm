import { create } from 'zustand'

import type { ApiCallType } from '@/api/types'

export type CallPhase = 'idle' | 'ringing-out' | 'ringing-in' | 'connecting' | 'active' | 'ended'

export interface ActiveCall {
  callId: string
  conversationId: number
  peerId: number | null
  callType: ApiCallType
  direction: 'incoming' | 'outgoing'
  phase: CallPhase
  startedAt: number | null
  endReason?: string
}

interface CallState {
  call: ActiveCall | null
  micEnabled: boolean
  cameraEnabled: boolean
  /** Local and remote tracks live outside React; only their presence is state. */
  hasRemoteStream: boolean

  startOutgoing: (call: Omit<ActiveCall, 'phase' | 'startedAt' | 'direction'>) => void
  receiveIncoming: (call: Omit<ActiveCall, 'phase' | 'startedAt' | 'direction'>) => void
  setPhase: (phase: CallPhase) => void
  setRemoteStream: (present: boolean) => void
  toggleMic: () => void
  toggleCamera: () => void
  endCall: (reason?: string) => void
  clear: () => void
}

export const useCallStore = create<CallState>()((set) => ({
  call: null,
  micEnabled: true,
  cameraEnabled: true,
  hasRemoteStream: false,

  startOutgoing: (call) =>
    set({
      call: { ...call, direction: 'outgoing', phase: 'ringing-out', startedAt: null },
      micEnabled: true,
      cameraEnabled: call.callType === 'video',
      hasRemoteStream: false,
    }),

  receiveIncoming: (call) =>
    set({
      call: { ...call, direction: 'incoming', phase: 'ringing-in', startedAt: null },
      micEnabled: true,
      cameraEnabled: call.callType === 'video',
      hasRemoteStream: false,
    }),

  setPhase: (phase) =>
    set((state) => {
      if (!state.call) return state
      return {
        call: {
          ...state.call,
          phase,
          startedAt:
            phase === 'active' ? (state.call.startedAt ?? Date.now()) : state.call.startedAt,
        },
      }
    }),

  setRemoteStream: (hasRemoteStream) => set({ hasRemoteStream }),
  toggleMic: () => set((state) => ({ micEnabled: !state.micEnabled })),
  toggleCamera: () => set((state) => ({ cameraEnabled: !state.cameraEnabled })),

  endCall: (endReason) =>
    set((state) =>
      state.call
        ? { call: { ...state.call, phase: 'ended', endReason }, hasRemoteStream: false }
        : state,
    ),

  clear: () => set({ call: null, hasRemoteStream: false }),
}))
