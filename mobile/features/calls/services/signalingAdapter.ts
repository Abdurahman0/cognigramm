import { mapApiCallToCallSession } from "@/services/api/adapters";
import type { ApiCallSession, ApiSocketEnvelope } from "@/services/api";
import { realtimeSocketClient } from "@/services/realtime/socketClient";
import { useAuthStore } from "@/store/authStore";
import { SIGNALING_EVENT_MAP } from "@/features/calls/config/callConfig";
import type {
  CallSignalEnvelope,
  SignalingAcceptPayload,
  SignalingDeclinePayload,
  SignalingEndPayload,
  SignalingInboundEvent,
  SignalingStartPayload
} from "@/features/calls/types";
import { callLogger } from "@/features/calls/utils/callLogger";

const extractApiCallSession = (payload: unknown): ApiCallSession | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const toPositiveNumber = (value: unknown): number | null => {
    if (typeof value !== "number" && typeof value !== "string") {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  };

  const normalizeCallType = (value: unknown): ApiCallSession["call_type"] | null => {
    if (typeof value !== "string") {
      return null;
    }
    const normalized = value.toLowerCase();
    if (normalized === "audio" || normalized === "video") {
      return normalized as ApiCallSession["call_type"];
    }
    if (normalized === "voice") {
      return "audio";
    }
    return null;
  };

  const normalizeCallState = (value: unknown): ApiCallSession["state"] | null => {
    if (typeof value !== "string") {
      return null;
    }
    const normalized = value.toLowerCase();
    if (
      normalized === "ringing" ||
      normalized === "active" ||
      normalized === "ended" ||
      normalized === "missed" ||
      normalized === "rejected" ||
      normalized === "cancelled" ||
      normalized === "failed"
    ) {
      return normalized as ApiCallSession["state"];
    }
    return null;
  };

  const callCandidate = (payload as { call?: unknown }).call;
  if (!callCandidate || typeof callCandidate !== "object") {
    return null;
  }
  const call = callCandidate as Partial<ApiCallSession>;
  const conversationId = toPositiveNumber(call.conversation_id);
  const initiatorId = toPositiveNumber(call.initiator_id);
  const callType = normalizeCallType(call.call_type);
  const state = normalizeCallState(call.state);
  if (
    typeof call.id !== "string" ||
    !conversationId ||
    !initiatorId ||
    !callType ||
    !state ||
    typeof call.created_at !== "string" ||
    typeof call.updated_at !== "string" ||
    !Array.isArray(call.participants)
  ) {
    return null;
  }

  const participants = call.participants
    .map((participant) => {
      const row = participant as Partial<ApiCallSession["participants"][number]>;
      const userId = toPositiveNumber(row.user_id);
      if (
        !userId ||
        typeof row.state !== "string" ||
        typeof row.is_online_when_invited !== "boolean"
      ) {
        return null;
      }
      return {
        user_id: userId,
        state: row.state,
        is_online_when_invited: row.is_online_when_invited,
        joined_at: typeof row.joined_at === "string" ? row.joined_at : null,
        left_at: typeof row.left_at === "string" ? row.left_at : null,
        created_at: typeof row.created_at === "string" ? row.created_at : call.created_at
      };
    })
    .filter((row): row is ApiCallSession["participants"][number] => row != null);

  if (participants.length === 0) {
    return null;
  }

  return {
    id: call.id,
    conversation_id: conversationId,
    initiator_id: initiatorId,
    call_type: callType,
    state,
    started_at: typeof call.started_at === "string" ? call.started_at : null,
    ended_at: typeof call.ended_at === "string" ? call.ended_at : null,
    created_at: call.created_at,
    updated_at: call.updated_at,
    participants
  };
};

const extractActorUserId = (payload: unknown): string | undefined => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const userIdRaw =
    (payload as { from_user_id?: unknown }).from_user_id ??
    (payload as { user_id?: unknown }).user_id;
  if (typeof userIdRaw !== "string" && typeof userIdRaw !== "number") {
    return undefined;
  }
  return String(userIdRaw);
};

const extractErrorDetail = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") {
    return "Call signaling failed.";
  }
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim().length > 0) {
    return detail;
  }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === "string") {
      return first;
    }
    if (first && typeof first === "object") {
      const msg = (first as { msg?: unknown }).msg;
      if (typeof msg === "string" && msg.trim().length > 0) {
        return msg;
      }
    }
  }
  return "Call signaling failed.";
};

const extractWebRtcSignal = (payload: unknown): CallSignalEnvelope | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const source = payload as Record<string, unknown>;
  const callIdRaw = source.call_id;
  const signalTypeRaw = source.signal_type;
  if (typeof callIdRaw !== "string" || typeof signalTypeRaw !== "string") {
    return null;
  }
  if (
    signalTypeRaw !== "offer" &&
    signalTypeRaw !== "answer" &&
    signalTypeRaw !== "ice-candidate"
  ) {
    return null;
  }
  return {
    callId: callIdRaw,
    conversationId:
      typeof source.conversation_id === "number" || typeof source.conversation_id === "string"
        ? String(source.conversation_id)
        : undefined,
    fromUserId:
      typeof source.from_user_id === "number" || typeof source.from_user_id === "string"
        ? String(source.from_user_id)
        : undefined,
    targetUserId:
      typeof source.target_user_id === "number" || typeof source.target_user_id === "string"
        ? String(source.target_user_id)
        : undefined,
    signalType: signalTypeRaw,
    sdp: typeof source.sdp === "string" ? source.sdp : null,
    candidate:
      typeof source.candidate === "string"
        ? source.candidate
        : source.candidate &&
          typeof source.candidate === "object" &&
          typeof (source.candidate as { candidate?: unknown }).candidate === "string"
        ? {
            candidate: (source.candidate as { candidate: string }).candidate,
            sdpMid:
              typeof (source.candidate as { sdpMid?: unknown }).sdpMid === "string" ||
              (source.candidate as { sdpMid?: unknown }).sdpMid === null
                ? ((source.candidate as { sdpMid?: string | null }).sdpMid ?? null)
                : null,
            sdpMLineIndex:
              typeof (source.candidate as { sdpMLineIndex?: unknown }).sdpMLineIndex === "number" ||
              (source.candidate as { sdpMLineIndex?: unknown }).sdpMLineIndex === null
                ? ((source.candidate as { sdpMLineIndex?: number | null }).sdpMLineIndex ?? null)
                : null,
            usernameFragment:
              typeof (source.candidate as { usernameFragment?: unknown }).usernameFragment === "string" ||
              (source.candidate as { usernameFragment?: unknown }).usernameFragment === null
                ? ((source.candidate as { usernameFragment?: string | null }).usernameFragment ?? null)
                : null
          }
        : null
  };
};

const mapCallEnvelope = (
  type: SignalingInboundEvent["type"],
  payload: unknown
): SignalingInboundEvent | null => {
  if (
    type !== "call:incoming" &&
    type !== "call:invite-ack" &&
    type !== "call:accepted" &&
    type !== "call:declined" &&
    type !== "call:ended"
  ) {
    return null;
  }
  const apiCall = extractApiCallSession(payload);
  if (!apiCall) {
    return null;
  }
  const currentUserId = useAuthStore.getState().session?.userId ?? "";
  const session = mapApiCallToCallSession(apiCall, currentUserId || undefined);
  return {
    type,
    payload: {
      session,
      actorUserId: extractActorUserId(payload)
    }
  };
};

export const signalingAdapter = {
  sendStartCall(payload: SignalingStartPayload): void {
    callLogger.debug("send", SIGNALING_EVENT_MAP.outgoingStart, payload);
    realtimeSocketClient.send(SIGNALING_EVENT_MAP.outgoingStart, {
      conversation_id: payload.conversationId,
      call_type: payload.callType,
      call_id: payload.callId
    });
  },
  sendAcceptCall(payload: SignalingAcceptPayload): void {
    callLogger.debug("send", SIGNALING_EVENT_MAP.outgoingAccept, payload);
    realtimeSocketClient.send(SIGNALING_EVENT_MAP.outgoingAccept, {
      call_id: payload.callId
    });
  },
  sendDeclineCall(payload: SignalingDeclinePayload): void {
    callLogger.debug("send", SIGNALING_EVENT_MAP.outgoingDecline, payload);
    realtimeSocketClient.send(SIGNALING_EVENT_MAP.outgoingDecline, {
      call_id: payload.callId
    });
  },
  sendEndCall(payload: SignalingEndPayload): void {
    callLogger.debug("send", SIGNALING_EVENT_MAP.outgoingEnd, payload);
    realtimeSocketClient.send(SIGNALING_EVENT_MAP.outgoingEnd, {
      call_id: payload.callId
    });
  },
  sendWebRtcSignal(payload: CallSignalEnvelope): void {
    callLogger.debug("send", SIGNALING_EVENT_MAP.outgoingSignal, payload.signalType);
    realtimeSocketClient.send(SIGNALING_EVENT_MAP.outgoingSignal, {
      call_id: payload.callId,
      target_user_id: payload.targetUserId,
      signal_type: payload.signalType,
      sdp: payload.sdp ?? null,
      candidate: payload.candidate ?? null
    });
  },
  parseInboundEnvelope(envelope: ApiSocketEnvelope): SignalingInboundEvent | null {
    const { event, payload } = envelope;
    if (event === SIGNALING_EVENT_MAP.incomingInviteAck) {
      return mapCallEnvelope("call:invite-ack", payload);
    }
    if (event === SIGNALING_EVENT_MAP.incomingCall) {
      return mapCallEnvelope("call:incoming", payload);
    }
    if (event === SIGNALING_EVENT_MAP.incomingAccepted) {
      return mapCallEnvelope("call:accepted", payload);
    }
    if (event === SIGNALING_EVENT_MAP.incomingDeclined) {
      return mapCallEnvelope("call:declined", payload);
    }
    if (event === SIGNALING_EVENT_MAP.incomingEnded) {
      return mapCallEnvelope("call:ended", payload);
    }
    if (event === SIGNALING_EVENT_MAP.incomingSignal) {
      const signal = extractWebRtcSignal(payload);
      if (!signal) {
        return null;
      }
      return {
        type: "webrtc:signal",
        payload: signal
      };
    }
    if (event === SIGNALING_EVENT_MAP.incomingError) {
      const detail = extractErrorDetail(payload);
      if (!detail.toLowerCase().includes("call")) {
        return null;
      }
      return {
        type: "call:error",
        detail
      };
    }
    return null;
  }
};
