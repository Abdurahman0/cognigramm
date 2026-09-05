import { toast } from '@/components/ui/toast'
import { CallPeer, requestUserMedia } from '@/features/calls/webrtc'
import { realtime } from '@/realtime/socket'
import { useCallStore } from '@/stores/calls'
import type { ApiCallSession, ApiCallType } from '@/api/types'

/**
 * Call orchestration: signalling in, WebRTC out.
 *
 * A module singleton rather than a hook, for the same reason the socket is —
 * an incoming call must be answerable from any screen, and the peer connection
 * has to survive every re-render and route change in between.
 */

type StreamListener = (streams: { local: MediaStream | null; remote: MediaStream | null }) => void

let currentUserId = -1
let peer: CallPeer | null = null
let localStream: MediaStream | null = null
let remoteStream: MediaStream | null = null
let ringtone: (() => void) | null = null
const streamListeners = new Set<StreamListener>()

const emitStreams = (): void => {
  for (const listener of streamListeners) listener({ local: localStream, remote: remoteStream })
}

export const subscribeStreams = (listener: StreamListener): (() => void) => {
  streamListeners.add(listener)
  listener({ local: localStream, remote: remoteStream })
  return () => {
    streamListeners.delete(listener)
  }
}

const newCallId = (): string =>
  `call_${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(36)}`

/** The other side of a one-to-one call. */
const peerIdOf = (call: ApiCallSession): number | null =>
  call.participants.find((participant) => participant.user_id !== currentUserId)?.user_id ?? null

/**
 * A synthesised ring, so no audio asset has to ship. Two alternating tones at
 * a low gain — enough to notice, not enough to startle.
 */
const startRingtone = (): (() => void) => {
  try {
    const context = new AudioContext()
    const gain = context.createGain()
    gain.gain.value = 0.05
    gain.connect(context.destination)

    let stopped = false
    const beep = () => {
      if (stopped) return
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = 440
      oscillator.connect(gain)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.35)
    }
    beep()
    const timer = setInterval(beep, 1_800)

    return () => {
      stopped = true
      clearInterval(timer)
      void context.close()
    }
  } catch {
    return () => undefined
  }
}

const stopRingtone = (): void => {
  ringtone?.()
  ringtone = null
}

const teardown = (): void => {
  stopRingtone()
  peer?.close()
  peer = null
  localStream?.getTracks().forEach((track) => track.stop())
  localStream = null
  remoteStream = null
  emitStreams()
}

const openMedia = async (callType: ApiCallType): Promise<MediaStream | null> => {
  try {
    localStream = await requestUserMedia(callType === 'video')
    emitStreams()
    return localStream
  } catch (error) {
    toast.error(
      'Microphone unavailable',
      error instanceof Error ? error.message : 'Permission denied',
    )
    return null
  }
}

const createPeer = (callId: string, targetUserId: number): CallPeer => {
  const created = new CallPeer({
    callId,
    targetUserId,
    onRemoteStream: (stream) => {
      remoteStream = stream
      useCallStore.getState().setRemoteStream(true)
      useCallStore.getState().setPhase('active')
      stopRingtone()
      emitStreams()
    },
    onStateChange: (state) => {
      if (state === 'failed' || state === 'closed') {
        callEngine.hangUp('Connection lost')
      }
    },
  })
  if (localStream) created.attachLocalStream(localStream)
  return created
}

export const callEngine = {
  async start(conversationId: number, peerId: number | null, callType: ApiCallType): Promise<void> {
    if (useCallStore.getState().call) {
      toast.info('Already in a call')
      return
    }

    const callId = newCallId()
    useCallStore.getState().startOutgoing({ callId, conversationId, peerId, callType })

    if (!(await openMedia(callType))) {
      useCallStore.getState().clear()
      return
    }

    ringtone = startRingtone()
    realtime.send('call_invite', {
      conversation_id: conversationId,
      call_type: callType,
      call_id: callId,
    })
  },

  async accept(): Promise<void> {
    const { call } = useCallStore.getState()
    if (!call) return
    stopRingtone()

    if (!(await openMedia(call.callType))) {
      callEngine.reject()
      return
    }

    // The peer is created before accepting so the caller's offer, which can
    // arrive immediately after, has somewhere to land.
    if (call.peerId !== null) peer = createPeer(call.callId, call.peerId)
    useCallStore.getState().setPhase('connecting')
    realtime.send('call_accept', { call_id: call.callId })
  },

  reject(): void {
    const { call } = useCallStore.getState()
    if (!call) return
    realtime.send('call_reject', { call_id: call.callId })
    teardown()
    useCallStore.getState().clear()
  },

  hangUp(reason?: string): void {
    const { call } = useCallStore.getState()
    if (!call) return
    realtime.send('call_end', { call_id: call.callId })
    teardown()
    useCallStore.getState().endCall(reason)
    // Leave the ended card up briefly so the reason is readable.
    setTimeout(() => useCallStore.getState().clear(), 1_200)
  },

  toggleMic(): void {
    const next = !useCallStore.getState().micEnabled
    localStream?.getAudioTracks().forEach((track) => {
      track.enabled = next
    })
    useCallStore.getState().toggleMic()
  },

  toggleCamera(): void {
    const next = !useCallStore.getState().cameraEnabled
    localStream?.getVideoTracks().forEach((track) => {
      track.enabled = next
    })
    useCallStore.getState().toggleCamera()
  },
}

/**
 * Wires call signalling to the engine. Called once, from the realtime provider.
 */
export function initCallEngine(userId: number): () => void {
  currentUserId = userId
  const store = useCallStore.getState
  const unsubscribers: Array<() => void> = []

  unsubscribers.push(
    realtime.on('incoming_call', ({ call, from_user_id }) => {
      if (store().call) {
        // Busy: decline immediately rather than leaving the caller ringing.
        realtime.send('call_reject', { call_id: call.id })
        return
      }
      store().receiveIncoming({
        callId: call.id,
        conversationId: call.conversation_id,
        peerId: from_user_id,
        callType: call.call_type,
      })
      ringtone = startRingtone()
    }),
  )

  unsubscribers.push(
    realtime.on('call_invite_ack', ({ call, offline_user_ids }) => {
      if (offline_user_ids?.length) {
        toast.info('Not reachable', 'The other side is offline; this will show as a missed call.')
        callEngine.hangUp('Unavailable')
        return
      }
      // The server may have resolved a peer the caller did not know about.
      const resolved = peerIdOf(call)
      const current = store().call
      if (current && current.peerId === null && resolved !== null) {
        useCallStore.setState({ call: { ...current, peerId: resolved } })
      }
    }),
  )

  unsubscribers.push(
    realtime.on('call_accepted', async ({ call, user_id }) => {
      const current = store().call
      if (!current || current.callId !== call.id) return
      if (current.direction !== 'outgoing') return

      stopRingtone()
      store().setPhase('connecting')
      const targetUserId = user_id === currentUserId ? peerIdOf(call) : user_id
      if (targetUserId === null) return

      // The caller offers only once the callee has accepted, so no media flows
      // before someone picks up.
      peer = createPeer(call.id, targetUserId)
      await peer.createOffer().catch(() => callEngine.hangUp('Could not start media'))
    }),
  )

  unsubscribers.push(
    realtime.on('call_signal', async (payload) => {
      const current = store().call
      if (!current || current.callId !== payload.call_id) return

      const fromUserId = payload.from_user_id ?? current.peerId
      if (fromUserId === null || fromUserId === undefined) return

      peer ??= createPeer(current.callId, fromUserId)

      try {
        if (payload.signal_type === 'offer' && payload.sdp) {
          await peer.acceptOffer(payload.sdp)
        } else if (payload.signal_type === 'answer' && payload.sdp) {
          await peer.acceptAnswer(payload.sdp)
        } else if (payload.signal_type === 'ice' && payload.candidate) {
          await peer.addIceCandidate(payload.candidate)
        }
      } catch {
        callEngine.hangUp('Negotiation failed')
      }
    }),
  )

  unsubscribers.push(
    realtime.on('call_rejected', ({ call }) => {
      if (store().call?.callId !== call.id) return
      teardown()
      store().endCall('Declined')
      setTimeout(() => store().clear(), 1_200)
    }),
  )

  const finish =
    (reason: string) =>
    ({ call }: { call: ApiCallSession }) => {
      if (store().call?.callId !== call.id) return
      teardown()
      store().endCall(reason)
      setTimeout(() => store().clear(), 1_200)
    }

  unsubscribers.push(realtime.on('call_ended', finish('Call ended')))
  unsubscribers.push(realtime.on('call_participant_left', finish('Participant left')))

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe()
    teardown()
  }
}
