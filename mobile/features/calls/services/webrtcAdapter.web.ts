import type {
  CallSignalEnvelope,
  CallType,
  RtcIceCandidatePayload,
  WebRtcSessionContext
} from "@/features/calls/types";
import { callLogger } from "@/features/calls/utils/callLogger";
import {
  normalizeRuntimeError,
  parseInboundCandidate,
  toCandidatePayload
} from "@/features/calls/services/webrtcAdapter.shared";
import {
  createInitialSnapshot,
  type CreateWebRtcAdapterOptions,
  type WebRtcAdapter,
  type WebRtcAdapterListener,
  type WebRtcAdapterSnapshot,
  WebRtcNotConfiguredError
} from "@/features/calls/services/webrtcAdapter.types";

const defaultUnsupportedReason =
  "This browser does not support required WebRTC APIs (RTCPeerConnection/getUserMedia).";

class WebWebRtcAdapter implements WebRtcAdapter {
  private readonly listeners = new Set<WebRtcAdapterListener>();
  private readonly onSignal: ((signal: CallSignalEnvelope) => void) | undefined;

  private snapshot: WebRtcAdapterSnapshot = createInitialSnapshot();
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private sessionContext: WebRtcSessionContext | null = null;
  private activeCallType: CallType = "audio";
  private pendingRemoteCandidates: RtcIceCandidatePayload[] = [];
  private lastSignalSenderId = "";
  private hasLocalOffer = false;
  private offerInFlight = false;

  constructor(options: CreateWebRtcAdapterOptions = {}) {
    this.onSignal = options.onSignal;
  }

  getSnapshot(): WebRtcAdapterSnapshot {
    return this.snapshot;
  }

  subscribe(listener: WebRtcAdapterListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async ensureReady(callType: CallType): Promise<void> {
    this.assertBrowserWebRtcSupport();
    if (this.localStream && this.peerConnection && this.activeCallType === callType) {
      await this.maybeCreateLocalOffer();
      return;
    }

    this.activeCallType = callType;
    this.hasLocalOffer = false;
    this.pendingRemoteCandidates = [];
    this.lastSignalSenderId = "";
    this.releasePeerResources();
    this.patchSnapshot({
      transportState: "connecting",
      errorMessage: "",
      localMedia: {
        ...this.snapshot.localMedia,
        errorMessage: ""
      },
      remoteMedia: {
        hasStream: false,
        hasVideo: false,
        stream: null
      }
    });

    try {
      this.peerConnection = this.createPeerConnection();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video" ? { facingMode: "user" } : false
      });
      this.localStream = stream;
      stream.getTracks().forEach((track) => {
        this.peerConnection?.addTrack(track, stream);
      });

      this.syncLocalMediaState();
      this.syncRemoteMediaState();
      this.patchSnapshot({
        transportState: "idle",
        errorMessage: "",
        localMedia: {
          ...this.snapshot.localMedia,
          errorMessage: ""
        }
      });
      await this.maybeCreateLocalOffer();
      callLogger.debug("webrtc.web ensureReady complete", callType);
    } catch (error) {
      const message = normalizeRuntimeError("Failed to access media devices.", error);
      this.patchSnapshot({
        transportState: "failed",
        errorMessage: message,
        localMedia: {
          ...this.snapshot.localMedia,
          errorMessage: message
        }
      });
      throw new Error(message);
    }
  }

  async setSessionContext(context: WebRtcSessionContext | null): Promise<void> {
    const previousCallId = this.sessionContext?.callId ?? "";
    const nextCallId = context?.callId ?? "";
    this.sessionContext = context;

    if (!context) {
      this.hasLocalOffer = false;
      this.pendingRemoteCandidates = [];
      this.lastSignalSenderId = "";
      return;
    }

    this.activeCallType = context.callType;
    if (previousCallId !== "" && previousCallId !== nextCallId) {
      this.hasLocalOffer = false;
      this.pendingRemoteCandidates = [];
      this.lastSignalSenderId = "";
      this.syncRemoteMediaState();
    }

    await this.maybeCreateLocalOffer();
  }

  async handleInboundSignal(signal: CallSignalEnvelope): Promise<void> {
    this.assertBrowserWebRtcSupport();
    if (signal.fromUserId) {
      this.lastSignalSenderId = signal.fromUserId;
      if (this.sessionContext && !this.sessionContext.targetUserId) {
        this.sessionContext = {
          ...this.sessionContext,
          targetUserId: signal.fromUserId
        };
      }
    }

    await this.ensureReady(this.sessionContext?.callType ?? this.activeCallType);
    const connection = this.assertPeerConnection();

    if (signal.signalType === "offer") {
      if (!signal.sdp) {
        throw new Error("Missing offer SDP.");
      }
      this.patchSnapshot({
        transportState: "creating-answer",
        errorMessage: ""
      });
      await connection.setRemoteDescription(
        new RTCSessionDescription({ type: "offer", sdp: signal.sdp })
      );
      await this.flushPendingRemoteCandidates();
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      this.emitWebRtcSignal("answer", answer.sdp ?? null, null, signal.fromUserId);
      this.patchSnapshot({ transportState: "connecting" });
      return;
    }

    if (signal.signalType === "answer") {
      if (!signal.sdp) {
        throw new Error("Missing answer SDP.");
      }
      await connection.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp: signal.sdp })
      );
      await this.flushPendingRemoteCandidates();
      this.patchSnapshot({ transportState: "connecting" });
      return;
    }

    const candidatePayload = parseInboundCandidate(signal.candidate);
    if (!candidatePayload) {
      callLogger.debug("webrtc.web ice skipped invalid payload");
      return;
    }

    if (!connection.remoteDescription) {
      this.pendingRemoteCandidates.push(candidatePayload);
      return;
    }

    await connection.addIceCandidate(new RTCIceCandidate(candidatePayload));
  }

  async toggleMute(nextMuted: boolean): Promise<void> {
    const stream = this.assertLocalStream();
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("No audio track available for this call.");
    }
    audioTracks.forEach((track) => {
      track.enabled = !nextMuted;
    });
    this.syncLocalMediaState();
  }

  async toggleCamera(nextEnabled: boolean): Promise<void> {
    if (this.activeCallType !== "video") {
      throw new Error("Camera controls are only available for video calls.");
    }
    const stream = this.assertLocalStream();
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      throw new Error("No video track available for this call.");
    }
    videoTracks.forEach((track) => {
      track.enabled = nextEnabled;
    });
    this.syncLocalMediaState();
  }

  async switchCamera(): Promise<void> {
    throw new Error("Switch camera is not supported in browser mode.");
  }

  async toggleSpeaker(nextEnabled: boolean): Promise<void> {
    this.patchSnapshot({
      speakerEnabled: nextEnabled
    });
  }

  async cleanup(): Promise<void> {
    callLogger.debug("webrtc.web cleanup");
    this.releasePeerResources();
    this.sessionContext = null;
    this.pendingRemoteCandidates = [];
    this.lastSignalSenderId = "";
    this.hasLocalOffer = false;
    this.offerInFlight = false;
    this.snapshot = createInitialSnapshot();
    this.emit();
  }

  private assertBrowserWebRtcSupport(): void {
    const hasWindow = typeof window !== "undefined";
    const hasNavigator = typeof navigator !== "undefined";
    const hasMediaDevices = hasNavigator && Boolean(navigator.mediaDevices?.getUserMedia);
    const hasPeerConnection = hasWindow && typeof window.RTCPeerConnection !== "undefined";
    if (hasMediaDevices && hasPeerConnection) {
      return;
    }

    this.patchSnapshot({
      transportState: "unsupported",
      errorMessage: defaultUnsupportedReason,
      localMedia: {
        ...this.snapshot.localMedia,
        errorMessage: defaultUnsupportedReason
      }
    });
    throw new WebRtcNotConfiguredError(defaultUnsupportedReason);
  }

  private assertPeerConnection(): RTCPeerConnection {
    if (!this.peerConnection) {
      throw new Error("Peer connection is not initialized.");
    }
    return this.peerConnection;
  }

  private assertLocalStream(): MediaStream {
    if (!this.localStream) {
      throw new Error("Local media stream is not available.");
    }
    return this.localStream;
  }

  private emit(): void {
    this.listeners.forEach((listener) => {
      listener(this.snapshot);
    });
  }

  private patchSnapshot(next: Partial<WebRtcAdapterSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...next
    };
    this.emit();
  }

  private createPeerConnection(): RTCPeerConnection {
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    connection.onicecandidate = (event) => {
      const candidatePayload = toCandidatePayload(event.candidate as unknown as {
        candidate?: unknown;
        sdpMid?: unknown;
        sdpMLineIndex?: unknown;
        usernameFragment?: unknown;
        toJSON?: () => unknown;
      });
      if (!candidatePayload) {
        return;
      }
      this.emitWebRtcSignal("ice-candidate", null, candidatePayload, undefined);
    };

    connection.ontrack = (event) => {
      const stream = event.streams?.[0] ?? null;
      if (stream) {
        this.remoteStream = stream;
      } else if (event.track) {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
      }
      this.syncRemoteMediaState();
    };

    connection.onconnectionstatechange = () => {
      this.applyConnectionState(connection.connectionState);
    };
    connection.oniceconnectionstatechange = () => {
      this.applyIceConnectionState(connection.iceConnectionState);
    };

    return connection;
  }

  private applyConnectionState(state: RTCPeerConnectionState): void {
    if (state === "connected") {
      this.patchSnapshot({ transportState: "connected", errorMessage: "" });
      return;
    }
    if (state === "connecting") {
      this.patchSnapshot({ transportState: "connecting" });
      return;
    }
    if (state === "failed" || state === "disconnected") {
      this.patchSnapshot({
        transportState: "failed",
        errorMessage: "Connection lost. Please retry the call."
      });
      return;
    }
    if (state === "closed") {
      this.patchSnapshot({ transportState: "closed" });
    }
  }

  private applyIceConnectionState(state: RTCIceConnectionState): void {
    if (state === "connected" || state === "completed") {
      this.patchSnapshot({ transportState: "connected", errorMessage: "" });
      return;
    }
    if (state === "checking") {
      this.patchSnapshot({ transportState: "connecting" });
      return;
    }
    if (state === "failed" || state === "disconnected") {
      this.patchSnapshot({
        transportState: "failed",
        errorMessage: "Network quality is too low for a stable call."
      });
      return;
    }
    if (state === "closed") {
      this.patchSnapshot({ transportState: "closed" });
    }
  }

  private async maybeCreateLocalOffer(): Promise<void> {
    if (!this.sessionContext) {
      return;
    }
    if (this.sessionContext.direction !== "outgoing") {
      return;
    }
    if (
      this.sessionContext.status !== "connecting" &&
      this.sessionContext.status !== "connected"
    ) {
      return;
    }
    if (this.hasLocalOffer || this.offerInFlight) {
      return;
    }
    if (!this.localStream || !this.peerConnection) {
      return;
    }

    const targetUserId = this.resolveSignalTarget(undefined);
    if (!targetUserId) {
      callLogger.debug("webrtc.web offer waiting for target user");
      return;
    }

    try {
      this.offerInFlight = true;
      this.patchSnapshot({
        transportState: "creating-offer",
        errorMessage: ""
      });
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.hasLocalOffer = true;
      this.emitWebRtcSignal("offer", offer.sdp ?? null, null, targetUserId);
      this.patchSnapshot({ transportState: "connecting" });
    } catch (error) {
      const message = normalizeRuntimeError("Failed to create call offer.", error);
      this.patchSnapshot({
        transportState: "failed",
        errorMessage: message,
        localMedia: {
          ...this.snapshot.localMedia,
          errorMessage: message
        }
      });
      throw new Error(message);
    } finally {
      this.offerInFlight = false;
    }
  }

  private emitWebRtcSignal(
    signalType: CallSignalEnvelope["signalType"],
    sdp: string | null,
    candidate: RtcIceCandidatePayload | null,
    explicitTargetUserId: string | undefined
  ): void {
    if (!this.sessionContext) {
      return;
    }
    const targetUserId = this.resolveSignalTarget(explicitTargetUserId);
    if (!targetUserId) {
      callLogger.warn("webrtc.web signal dropped: target user unknown", signalType);
      return;
    }
    this.onSignal?.({
      callId: this.sessionContext.callId,
      targetUserId,
      signalType,
      sdp,
      candidate
    });
  }

  private resolveSignalTarget(explicitTargetUserId: string | undefined): string {
    if (explicitTargetUserId && explicitTargetUserId.length > 0) {
      return explicitTargetUserId;
    }
    if (this.sessionContext?.targetUserId && this.sessionContext.targetUserId.length > 0) {
      return this.sessionContext.targetUserId;
    }
    if (this.lastSignalSenderId.length > 0) {
      return this.lastSignalSenderId;
    }
    return "";
  }

  private async flushPendingRemoteCandidates(): Promise<void> {
    if (!this.peerConnection || this.pendingRemoteCandidates.length === 0) {
      return;
    }
    const candidates = [...this.pendingRemoteCandidates];
    this.pendingRemoteCandidates = [];
    for (const row of candidates) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(row));
    }
  }

  private syncLocalMediaState(): void {
    const stream = this.localStream;
    const audioTracks = stream?.getAudioTracks() ?? [];
    const videoTracks = stream?.getVideoTracks() ?? [];
    const audioEnabled = audioTracks.some((track) => track.enabled);
    const videoEnabled = videoTracks.some((track) => track.enabled);

    this.patchSnapshot({
      localMedia: {
        hasStream: Boolean(stream),
        audioEnabled,
        videoEnabled,
        stream,
        errorMessage: this.snapshot.localMedia.errorMessage
      },
      isMuted: audioTracks.length > 0 ? !audioEnabled : false,
      isCameraEnabled: videoEnabled,
      canSwitchCamera: false
    });
  }

  private syncRemoteMediaState(): void {
    const stream = this.remoteStream;
    const hasVideo = (stream?.getVideoTracks() ?? []).length > 0;
    this.patchSnapshot({
      remoteMedia: {
        hasStream: Boolean(stream),
        hasVideo,
        stream
      }
    });
  }

  private releasePeerResources(): void {
    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.localStream?.getTracks().forEach((track) => {
      track.stop();
    });
    this.localStream = null;

    this.remoteStream?.getTracks().forEach((track) => {
      track.stop();
    });
    this.remoteStream = null;
  }
}

export const createWebRtcAdapter = (
  options: CreateWebRtcAdapterOptions = {}
): WebRtcAdapter => {
  return new WebWebRtcAdapter(options);
};

export type { WebRtcAdapterSnapshot };
export { WebRtcNotConfiguredError };
