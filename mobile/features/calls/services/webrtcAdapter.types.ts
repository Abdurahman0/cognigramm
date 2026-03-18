import type {
  CallSignalEnvelope,
  CallType,
  LocalMediaState,
  RemoteMediaState,
  RtcTransportState,
  WebRtcSessionContext
} from "@/features/calls/types";

export interface WebRtcAdapterSnapshot {
  transportState: RtcTransportState;
  localMedia: LocalMediaState;
  remoteMedia: RemoteMediaState;
  isMuted: boolean;
  isCameraEnabled: boolean;
  speakerEnabled: boolean;
  canSwitchCamera: boolean;
  errorMessage: string;
}

export type WebRtcAdapterListener = (
  snapshot: WebRtcAdapterSnapshot
) => void;

export interface CreateWebRtcAdapterOptions {
  onSignal?: (signal: CallSignalEnvelope) => void;
}

export interface WebRtcAdapter {
  getSnapshot: () => WebRtcAdapterSnapshot;
  subscribe: (listener: WebRtcAdapterListener) => () => void;
  ensureReady: (callType: CallType) => Promise<void>;
  setSessionContext: (context: WebRtcSessionContext | null) => Promise<void>;
  handleInboundSignal: (signal: CallSignalEnvelope) => Promise<void>;
  toggleMute: (nextMuted: boolean) => Promise<void>;
  toggleCamera: (nextEnabled: boolean) => Promise<void>;
  switchCamera: () => Promise<void>;
  toggleSpeaker: (nextEnabled: boolean) => Promise<void>;
  cleanup: () => Promise<void>;
}

export class WebRtcNotConfiguredError extends Error {
  constructor(message = "WebRTC adapter is not configured.") {
    super(message);
    this.name = "WebRtcNotConfiguredError";
  }
}

export const createInitialSnapshot = (
  unsupportedReason = ""
): WebRtcAdapterSnapshot => ({
  transportState: unsupportedReason ? "unsupported" : "idle",
  localMedia: {
    hasStream: false,
    audioEnabled: false,
    videoEnabled: false,
    stream: null,
    errorMessage: unsupportedReason
  },
  remoteMedia: {
    hasStream: false,
    hasVideo: false,
    stream: null
  },
  isMuted: false,
  isCameraEnabled: false,
  speakerEnabled: true,
  canSwitchCamera: false,
  errorMessage: unsupportedReason
});
