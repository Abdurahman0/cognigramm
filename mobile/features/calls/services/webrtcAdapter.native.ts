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

interface MediaStreamTrackLike {
  enabled: boolean;
  stop: () => void;
  _switchCamera?: () => void;
}

interface MediaStreamLike {
  getTracks: () => MediaStreamTrackLike[];
  getAudioTracks: () => MediaStreamTrackLike[];
  getVideoTracks: () => MediaStreamTrackLike[];
  addTrack?: (track: MediaStreamTrackLike) => void;
  release?: () => void;
}

interface RTCSessionDescriptionLike {
  type: "offer" | "answer";
  sdp?: string;
}

interface RTCIceCandidateLike {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
  toJSON?: () => RtcIceCandidatePayload;
}

interface RTCIceCandidateEventLike {
  candidate?: RTCIceCandidateLike | null;
}

interface RTCTrackEventLike {
  streams?: MediaStreamLike[];
  track?: MediaStreamTrackLike;
}

interface RTCPeerConnectionLike {
  connectionState?: string;
  iceConnectionState?: string;
  remoteDescription?: RTCSessionDescriptionLike | null;
  onicecandidate: ((event: RTCIceCandidateEventLike) => void) | null;
  ontrack: ((event: RTCTrackEventLike) => void) | null;
  onconnectionstatechange: (() => void) | null;
  oniceconnectionstatechange: (() => void) | null;
  createOffer: () => Promise<RTCSessionDescriptionLike>;
  createAnswer: () => Promise<RTCSessionDescriptionLike>;
  setLocalDescription: (description: RTCSessionDescriptionLike) => Promise<void>;
  setRemoteDescription: (description: RTCSessionDescriptionLike) => Promise<void>;
  addIceCandidate: (candidate: RTCIceCandidateLike) => Promise<void>;
  addTrack: (track: MediaStreamTrackLike, stream: MediaStreamLike) => void;
  close: () => void;
}

interface MediaDevicesLike {
  getUserMedia: (constraints: {
    audio: boolean | Record<string, unknown>;
    video: boolean | Record<string, unknown>;
  }) => Promise<MediaStreamLike>;
}

interface WebRtcModuleLike {
  RTCPeerConnection: new (configuration?: Record<string, unknown>) => RTCPeerConnectionLike;
  RTCIceCandidate: new (candidate: RtcIceCandidatePayload) => RTCIceCandidateLike;
  RTCSessionDescription: new (
    description: RTCSessionDescriptionLike
  ) => RTCSessionDescriptionLike;
  MediaStream: new () => MediaStreamLike;
  mediaDevices: MediaDevicesLike;
}

interface InCallManagerLike {
  setSpeakerphoneOn?: (enabled: boolean) => void;
  setForceSpeakerphoneOn?: (enabled: boolean | null) => void;
  /** Claims the audio session; routing only takes effect once a call is in progress. */
  start?: (setup?: { auto?: boolean; media?: "video" | "audio"; ringback?: string }) => void;
  stop?: (setup?: { busytone?: string }) => void;
  setKeepScreenOn?: (enabled: boolean) => void;
}

interface LoadedWebRtcModule {
  module: WebRtcModuleLike | null;
  unavailableReason: string;
}

const defaultUnsupportedReason =
  "WebRTC native module unavailable. Rebuild the dev client with react-native-webrtc linked.";
const expoGoUnsupportedReason =
  "WebRTC is not available in Expo Go. Build and open a development client with react-native-webrtc linked.";
const speakerUnsupportedReason =
  "Speaker routing control is unavailable. Install a native audio routing module (for example react-native-incall-manager).";
const volumeUnsupportedReason =
  "In-app playback volume is unavailable on this platform. Use the device volume keys, or install a native audio module that exposes an output gain.";

const isExpoGoRuntime = (): boolean => {
  try {
    const constants = require("expo-constants") as {
      appOwnership?: string;
      default?: { appOwnership?: string };
    };
    const ownership = constants.default?.appOwnership ?? constants.appOwnership;
    return ownership === "expo";
  } catch {
    return false;
  }
};

const loadWebRtcModule = (): LoadedWebRtcModule => {
  if (isExpoGoRuntime()) {
    return {
      module: null,
      unavailableReason: expoGoUnsupportedReason
    };
  }

  try {
    const runtimeModule = require("react-native-webrtc") as Partial<WebRtcModuleLike>;
    if (
      runtimeModule &&
      runtimeModule.RTCPeerConnection &&
      runtimeModule.RTCIceCandidate &&
      runtimeModule.RTCSessionDescription &&
      runtimeModule.MediaStream &&
      runtimeModule.mediaDevices?.getUserMedia
    ) {
      return {
        module: runtimeModule as WebRtcModuleLike,
        unavailableReason: ""
      };
    }
  } catch (error) {
    callLogger.warn("webrtc.native module load failed", error);
  }

  return {
    module: null,
    unavailableReason: defaultUnsupportedReason
  };
};

const loadInCallManager = (): InCallManagerLike | null => {
  // Prefer the package's JS wrapper: it normalises the iOS and Android differences that
  // the raw NativeModule leaves to the caller. Fall back to the bare module so a build
  // that only links the native side still routes audio.
  try {
    const module = require("react-native-incall-manager") as {
      default?: InCallManagerLike;
    } & InCallManagerLike;
    const wrapper = module.default ?? module;
    if (wrapper && typeof wrapper.setSpeakerphoneOn === "function") {
      return wrapper;
    }
  } catch {
    // not linked in this build
  }

  const reactNative = require("react-native") as {
    NativeModules?: Record<string, unknown>;
  };
  const nativeModule = reactNative.NativeModules?.InCallManager as
    | InCallManagerLike
    | undefined;

  if (
    nativeModule &&
    (typeof nativeModule.setSpeakerphoneOn === "function" ||
      typeof nativeModule.setForceSpeakerphoneOn === "function")
  ) {
    return nativeModule;
  }

  return null;
};

class NativeWebRtcAdapter implements WebRtcAdapter {
  private readonly listeners = new Set<WebRtcAdapterListener>();
  private readonly inCallManager: InCallManagerLike | null;
  private readonly onSignal: ((signal: CallSignalEnvelope) => void) | undefined;

  private webRtc: WebRtcModuleLike | null = null;
  private unsupportedReason = "";
  private moduleResolved = false;
  private snapshot: WebRtcAdapterSnapshot;
  private peerConnection: RTCPeerConnectionLike | null = null;
  private localStream: MediaStreamLike | null = null;
  private remoteStream: MediaStreamLike | null = null;
  private sessionContext: WebRtcSessionContext | null = null;
  private activeCallType: CallType = "audio";
  private pendingRemoteCandidates: RtcIceCandidatePayload[] = [];
  private lastSignalSenderId = "";
  private hasLocalOffer = false;
  private offerInFlight = false;
  private audioSessionActive = false;
  private cameraBeforeHold = false;
  private readyPromise: Promise<void> | null = null;
  private readyCallType: CallType | null = null;

  constructor(options: CreateWebRtcAdapterOptions = {}) {
    this.inCallManager = loadInCallManager();
    this.onSignal = options.onSignal;
    this.snapshot = {
      ...createInitialSnapshot(),
      canRouteAudio: Boolean(this.inCallManager)
    };
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

  /**
   * Overlapping callers share one initialisation. Without this each caller ran its own
   * `getUserMedia`, and because that await resolves long after the release at the top of
   * the method, every call but the last left a camera and microphone capturing forever.
   */
  async ensureReady(callType: CallType): Promise<void> {
    this.assertWebRtcModule();
    if (this.localStream && this.peerConnection && this.activeCallType === callType) {
      await this.maybeCreateLocalOffer();
      return;
    }
    if (this.readyPromise && this.readyCallType === callType) {
      return this.readyPromise;
    }

    this.readyCallType = callType;
    this.readyPromise = this.initialise(callType).finally(() => {
      this.readyPromise = null;
      this.readyCallType = null;
    });
    return this.readyPromise;
  }

  private async initialise(callType: CallType): Promise<void> {
    const module = this.assertWebRtcModule();
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
      this.peerConnection = this.createPeerConnection(module);
      const constraints = {
        audio: true,
        video: callType === "video" ? { facingMode: "user" } : false
      };
      const stream = await module.mediaDevices.getUserMedia(constraints);
      // A concurrent teardown may have landed while getUserMedia was in flight; if this
      // stream is no longer wanted, stop it rather than leaving the camera on.
      if (!this.peerConnection) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        return;
      }
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
      callLogger.debug("webrtc.native ensureReady complete", callType);
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
      this.releaseAudioSession();
      return;
    }

    this.activeCallType = context.callType;
    // Routing only takes effect once the audio session is claimed, so the speaker
    // toggle is inert until this runs.
    this.claimAudioSession(context.callType);

    if (previousCallId !== "" && previousCallId !== nextCallId) {
      this.hasLocalOffer = false;
      this.pendingRemoteCandidates = [];
      this.lastSignalSenderId = "";
      this.syncRemoteMediaState();
    }

    await this.maybeCreateLocalOffer();
  }

  async handleInboundSignal(signal: CallSignalEnvelope): Promise<void> {
    const module = this.assertWebRtcModule();

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
        new module.RTCSessionDescription({ type: "offer", sdp: signal.sdp })
      );
      await this.flushPendingRemoteCandidates();
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      this.emitWebRtcSignal("answer", answer.sdp ?? null, null, signal.fromUserId);
      this.patchSnapshot({
        transportState: "connecting"
      });
      return;
    }

    if (signal.signalType === "answer") {
      if (!signal.sdp) {
        throw new Error("Missing answer SDP.");
      }
      await connection.setRemoteDescription(
        new module.RTCSessionDescription({ type: "answer", sdp: signal.sdp })
      );
      await this.flushPendingRemoteCandidates();
      this.patchSnapshot({
        transportState: "connecting"
      });
      return;
    }

    const candidatePayload = parseInboundCandidate(signal.candidate);
    if (!candidatePayload) {
      callLogger.debug("webrtc.native ice skipped invalid payload");
      return;
    }

    if (!connection.remoteDescription) {
      this.pendingRemoteCandidates.push(candidatePayload);
      return;
    }

    await connection.addIceCandidate(new module.RTCIceCandidate(candidatePayload));
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


  /**
   * Hold: stop sending anything and stop playing what arrives, while leaving the peer
   * connection up so the call resumes without renegotiating. Releasing restores the
   * camera only if it was on beforehand, so hold never silently switches it back on.
   */
  async setHold(next: boolean): Promise<void> {
    const stream = this.assertLocalStream();
    if (next) {
      this.cameraBeforeHold = this.snapshot.isCameraEnabled;
    }
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = next ? false : this.cameraBeforeHold;
    });
    this.patchSnapshot({ isOnHold: next });
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
    if (this.activeCallType !== "video") {
      throw new Error("Camera switch is only available for video calls.");
    }
    const stream = this.assertLocalStream();
    const track = stream.getVideoTracks()[0];
    if (!track || typeof track._switchCamera !== "function") {
      throw new Error("Switch camera is not supported on this device.");
    }
    track._switchCamera();
    this.syncLocalMediaState();
  }

  /**
   * react-native-webrtc exposes no gain on a remote track and InCallManager has no
   * volume API, so this is deliberately unsupported rather than silently doing nothing.
   * Routing to the loudspeaker with `toggleSpeaker` is the loudness control on device.
   */
  async setOutputVolume(): Promise<void> {
    throw new Error(volumeUnsupportedReason);
  }

  private claimAudioSession(callType: CallType): void {
    if (!this.inCallManager || this.audioSessionActive) {
      return;
    }
    this.audioSessionActive = true;
    try {
      this.inCallManager.start?.({ media: callType === "video" ? "video" : "audio" });
      this.inCallManager.setKeepScreenOn?.(true);
      // Video calls belong on the loudspeaker; audio calls start at the earpiece.
      this.inCallManager.setForceSpeakerphoneOn?.(callType === "video" ? true : null);
      this.patchSnapshot({ speakerEnabled: callType === "video" });
    } catch {
      this.audioSessionActive = false;
    }
  }

  private releaseAudioSession(): void {
    if (!this.inCallManager || !this.audioSessionActive) {
      return;
    }
    this.audioSessionActive = false;
    try {
      this.inCallManager.setKeepScreenOn?.(false);
      this.inCallManager.setForceSpeakerphoneOn?.(null);
      this.inCallManager.stop?.();
    } catch {
      // session already torn down
    }
  }

  async toggleSpeaker(nextEnabled: boolean): Promise<void> {
    if (!this.inCallManager) {
      throw new Error(speakerUnsupportedReason);
    }
    this.inCallManager.setSpeakerphoneOn?.(nextEnabled);
    this.inCallManager.setForceSpeakerphoneOn?.(nextEnabled);
    this.patchSnapshot({
      speakerEnabled: nextEnabled
    });
  }

  async cleanup(): Promise<void> {
    callLogger.debug("webrtc.native cleanup");
    this.releaseAudioSession();
    this.releasePeerResources();
    this.sessionContext = null;
    this.pendingRemoteCandidates = [];
    this.lastSignalSenderId = "";
    this.hasLocalOffer = false;
    this.offerInFlight = false;
    this.snapshot = createInitialSnapshot(this.unsupportedReason);
    this.emit();
  }

  private assertWebRtcModule(): WebRtcModuleLike {
    this.resolveWebRtcModule();
    if (!this.webRtc) {
      throw new WebRtcNotConfiguredError(this.unsupportedReason || defaultUnsupportedReason);
    }
    return this.webRtc;
  }

  private assertPeerConnection(): RTCPeerConnectionLike {
    if (!this.peerConnection) {
      throw new Error("Peer connection is not initialized.");
    }
    return this.peerConnection;
  }

  private assertLocalStream(): MediaStreamLike {
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

  private createPeerConnection(module: WebRtcModuleLike): RTCPeerConnectionLike {
    const connection = new module.RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });

    connection.onicecandidate = (event) => {
      const candidatePayload = toCandidatePayload(event.candidate);
      if (!candidatePayload) {
        return;
      }
      this.emitWebRtcSignal("ice-candidate", null, candidatePayload, undefined);
    };

    connection.ontrack = (event) => {
      const incomingStream = event.streams?.[0] ?? null;
      if (incomingStream) {
        this.remoteStream = incomingStream;
      } else if (event.track) {
        if (!this.remoteStream) {
          this.remoteStream = new module.MediaStream();
        }
        this.remoteStream.addTrack?.(event.track);
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

  private applyConnectionState(state: string | undefined): void {
    if (!state) {
      return;
    }
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

  private applyIceConnectionState(state: string | undefined): void {
    if (!state) {
      return;
    }
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
      callLogger.debug("webrtc.native offer waiting for target user");
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
      callLogger.warn("webrtc.native signal dropped: target user unknown", signalType);
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
    if (!this.peerConnection || !this.webRtc || this.pendingRemoteCandidates.length === 0) {
      return;
    }
    const candidates = [...this.pendingRemoteCandidates];
    this.pendingRemoteCandidates = [];
    for (const row of candidates) {
      await this.peerConnection.addIceCandidate(new this.webRtc.RTCIceCandidate(row));
    }
  }

  private syncLocalMediaState(): void {
    const localStream = this.localStream;
    const audioTracks = localStream?.getAudioTracks() ?? [];
    const videoTracks = localStream?.getVideoTracks() ?? [];
    const audioEnabled = audioTracks.some((track) => track.enabled);
    const videoEnabled = videoTracks.some((track) => track.enabled);
    const canSwitchCamera = videoTracks.some(
      (track) => typeof track._switchCamera === "function"
    );

    this.patchSnapshot({
      localMedia: {
        hasStream: Boolean(localStream),
        audioEnabled,
        videoEnabled,
        stream: localStream,
        errorMessage: this.snapshot.localMedia.errorMessage
      },
      isMuted: audioTracks.length > 0 ? !audioEnabled : false,
      isCameraEnabled: videoEnabled,
      canSwitchCamera
    });
  }

  private syncRemoteMediaState(): void {
    const remoteStream = this.remoteStream;
    const hasVideo = (remoteStream?.getVideoTracks() ?? []).length > 0;
    this.patchSnapshot({
      remoteMedia: {
        hasStream: Boolean(remoteStream),
        hasVideo,
        stream: remoteStream
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

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream?.release?.();
    this.localStream = null;

    this.remoteStream?.getTracks().forEach((track) => track.stop());
    this.remoteStream?.release?.();
    this.remoteStream = null;
  }

  private resolveWebRtcModule(): void {
    if (this.moduleResolved) {
      return;
    }
    this.moduleResolved = true;
    const loaded = loadWebRtcModule();
    this.webRtc = loaded.module;
    this.unsupportedReason = loaded.unavailableReason;
    if (!loaded.module && loaded.unavailableReason) {
      this.patchSnapshot({
        transportState: "unsupported",
        errorMessage: loaded.unavailableReason,
        localMedia: {
          ...this.snapshot.localMedia,
          errorMessage: loaded.unavailableReason
        }
      });
    }
  }
}

export const createWebRtcAdapter = (
  options: CreateWebRtcAdapterOptions = {}
): WebRtcAdapter => {
  return new NativeWebRtcAdapter(options);
};

export type { WebRtcAdapterSnapshot };
export { WebRtcNotConfiguredError };
