import { realtime } from '@/realtime/socket'

/**
 * One peer connection, one call.
 *
 * Public STUN only: the backend relays signalling but does not run a TURN
 * server, so a symmetric-NAT pair will fail to connect. `ICE_SERVERS` is the
 * single place to add TURN credentials when one exists.
 */
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

interface PeerOptions {
  callId: string
  targetUserId: number
  onRemoteStream: (stream: MediaStream) => void
  onStateChange: (state: RTCPeerConnectionState) => void
}

export class CallPeer {
  readonly connection: RTCPeerConnection
  private readonly callId: string
  private readonly targetUserId: number
  /** Candidates that arrive before the remote description can not be added yet. */
  private pendingCandidates: RTCIceCandidateInit[] = []
  private remoteDescriptionSet = false
  private localStream: MediaStream | null = null

  constructor({ callId, targetUserId, onRemoteStream, onStateChange }: PeerOptions) {
    this.callId = callId
    this.targetUserId = targetUserId
    this.connection = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    this.connection.onicecandidate = (event) => {
      if (!event.candidate) return
      realtime.send('call_signal', {
        call_id: this.callId,
        target_user_id: this.targetUserId,
        signal_type: 'ice',
        sdp: null,
        candidate: event.candidate.toJSON(),
      })
    }

    this.connection.ontrack = (event) => {
      const [stream] = event.streams
      if (stream) onRemoteStream(stream)
    }

    this.connection.onconnectionstatechange = () => {
      onStateChange(this.connection.connectionState)
    }
  }

  attachLocalStream(stream: MediaStream): void {
    this.localStream = stream
    for (const track of stream.getTracks()) {
      this.connection.addTrack(track, stream)
    }
  }

  async createOffer(): Promise<void> {
    const offer = await this.connection.createOffer()
    await this.connection.setLocalDescription(offer)
    realtime.send('call_signal', {
      call_id: this.callId,
      target_user_id: this.targetUserId,
      signal_type: 'offer',
      sdp: offer.sdp ?? null,
      candidate: null,
    })
  }

  async acceptOffer(sdp: string): Promise<void> {
    await this.connection.setRemoteDescription({ type: 'offer', sdp })
    this.remoteDescriptionSet = true
    await this.drainCandidates()

    const answer = await this.connection.createAnswer()
    await this.connection.setLocalDescription(answer)
    realtime.send('call_signal', {
      call_id: this.callId,
      target_user_id: this.targetUserId,
      signal_type: 'answer',
      sdp: answer.sdp ?? null,
      candidate: null,
    })
  }

  async acceptAnswer(sdp: string): Promise<void> {
    await this.connection.setRemoteDescription({ type: 'answer', sdp })
    this.remoteDescriptionSet = true
    await this.drainCandidates()
  }

  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.remoteDescriptionSet) {
      this.pendingCandidates.push(candidate)
      return
    }
    await this.connection.addIceCandidate(candidate).catch(() => undefined)
  }

  private async drainCandidates(): Promise<void> {
    const queued = this.pendingCandidates
    this.pendingCandidates = []
    for (const candidate of queued) {
      await this.connection.addIceCandidate(candidate).catch(() => undefined)
    }
  }

  close(): void {
    this.connection.onicecandidate = null
    this.connection.ontrack = null
    this.connection.onconnectionstatechange = null
    for (const sender of this.connection.getSenders()) {
      sender.track?.stop()
    }
    this.localStream?.getTracks().forEach((track) => track.stop())
    this.localStream = null
    this.connection.close()
  }
}

/** Camera and microphone, with the mic always on and video only for a video call. */
export const requestUserMedia = (withVideo: boolean): Promise<MediaStream> =>
  navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: withVideo
      ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      : false,
  })
