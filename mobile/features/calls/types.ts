import type { ID } from "@/types/common";

export type CallType = "audio" | "video";
export type CallDirection = "incoming" | "outgoing";
export type CallStatus =
  | "idle"
  | "calling"
  | "ringing"
  | "connecting"
  | "connected"
  | "ended"
  | "failed"
  | "declined"
  | "missed";

export type BackendCallState =
  | "ringing"
  | "active"
  | "ended"
  | "missed"
  | "rejected"
  | "cancelled"
  | "failed";

export interface CallParticipant {
  userId: ID;
  state: string;
  isOnlineWhenInvited: boolean;
  joinedAt?: string;
  leftAt?: string;
  createdAt?: string;
}

export interface CallSession {
  id: ID;
  conversationId: ID;
  initiatorId: ID;
  callType: CallType;
  state: BackendCallState;
  status: CallStatus;
  direction: CallDirection;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
  participants: CallParticipant[];
}

export interface OutgoingCallRequest {
  conversationId: ID;
  callType: CallType;
  callId?: ID;
}

export interface RtcIceCandidatePayload {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface CallSignalEnvelope {
  callId: ID;
  conversationId?: ID;
  fromUserId?: ID;
  targetUserId?: ID;
  signalType: "offer" | "answer" | "ice-candidate";
  sdp?: string | null;
  candidate?: string | RtcIceCandidatePayload | null;
}

export interface WebRtcSessionContext {
  callId: ID;
  callType: CallType;
  direction: CallDirection;
  status: CallStatus;
  targetUserId?: ID;
}

export interface SignalingStartPayload {
  conversationId: number;
  callType: CallType;
  callId?: ID;
}

export interface SignalingAcceptPayload {
  callId: ID;
}

export interface SignalingDeclinePayload {
  callId: ID;
}

export interface SignalingEndPayload {
  callId: ID;
}

export interface SignalingCallPayload {
  session: CallSession;
  actorUserId?: ID;
}

export type SignalingInboundEvent =
  | { type: "call:incoming"; payload: SignalingCallPayload }
  | { type: "call:invite-ack"; payload: SignalingCallPayload }
  | { type: "call:accepted"; payload: SignalingCallPayload }
  | { type: "call:declined"; payload: SignalingCallPayload }
  | { type: "call:ended"; payload: SignalingCallPayload }
  | { type: "webrtc:signal"; payload: CallSignalEnvelope }
  | { type: "call:error"; detail: string };

export type RtcTransportState =
  | "idle"
  | "creating-offer"
  | "creating-answer"
  | "connecting"
  | "connected"
  | "failed"
  | "closed"
  | "unsupported";

export interface LocalMediaState {
  hasStream: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  stream: unknown | null;
  errorMessage: string;
}

export interface RemoteMediaState {
  hasStream: boolean;
  hasVideo: boolean;
  stream: unknown | null;
}

export interface CallRuntimeState {
  status: CallStatus;
  direction: CallDirection | null;
  transportState: RtcTransportState;
  localMedia: LocalMediaState;
  remoteMedia: RemoteMediaState;
  isMuted: boolean;
  isCameraEnabled: boolean;
  speakerEnabled: boolean;
  canSwitchCamera: boolean;
  errorMessage: string;
}

export interface MediaPermissionResult {
  granted: boolean;
  microphoneGranted: boolean;
  cameraGranted: boolean;
  errorMessage: string;
}

export interface CallControllerState {
  session: CallSession | null;
  runtime: CallRuntimeState;
  incomingFromUserId: ID;
  loading: boolean;
}

export interface CallControllerActions {
  startOutgoingCall: (request: OutgoingCallRequest) => Promise<ID>;
  joinCallById: (callId: ID) => Promise<void>;
  acceptIncomingCall: (callId: ID) => Promise<void>;
  declineIncomingCall: (callId: ID) => Promise<void>;
  endCall: (callId: ID) => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  clearError: () => void;
  resetRuntime: () => void;
}

export type UseCallControllerResult = CallControllerState & CallControllerActions;
