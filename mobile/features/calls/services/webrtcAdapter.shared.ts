import type {
  CallSignalEnvelope,
  RtcIceCandidatePayload
} from "@/features/calls/types";

interface CandidateLike {
  candidate?: unknown;
  sdpMid?: unknown;
  sdpMLineIndex?: unknown;
  usernameFragment?: unknown;
  toJSON?: () => unknown;
}

const normalizeCandidatePayload = (
  payload: Partial<RtcIceCandidatePayload>
): RtcIceCandidatePayload | null => {
  if (typeof payload.candidate !== "string" || payload.candidate.length === 0) {
    return null;
  }
  return {
    candidate: payload.candidate,
    sdpMid:
      typeof payload.sdpMid === "string" || payload.sdpMid === null
        ? payload.sdpMid
        : null,
    sdpMLineIndex:
      typeof payload.sdpMLineIndex === "number" || payload.sdpMLineIndex === null
        ? payload.sdpMLineIndex
        : null,
    usernameFragment:
      typeof payload.usernameFragment === "string" ||
      payload.usernameFragment === null
        ? payload.usernameFragment
        : null
  };
};

export const toCandidatePayload = (
  candidate: CandidateLike | null | undefined
): RtcIceCandidatePayload | null => {
  if (!candidate) {
    return null;
  }
  if (typeof candidate.toJSON === "function") {
    const serialized = candidate.toJSON();
    if (serialized && typeof serialized === "object") {
      const normalized = normalizeCandidatePayload(
        serialized as Partial<RtcIceCandidatePayload>
      );
      if (normalized) {
        return normalized;
      }
    }
  }
  return normalizeCandidatePayload(candidate as Partial<RtcIceCandidatePayload>);
};

export const parseInboundCandidate = (
  candidate: CallSignalEnvelope["candidate"]
): RtcIceCandidatePayload | null => {
  if (!candidate) {
    return null;
  }

  if (typeof candidate === "string") {
    try {
      const parsed = JSON.parse(candidate) as Partial<RtcIceCandidatePayload>;
      const normalized = normalizeCandidatePayload(parsed);
      if (normalized) {
        return normalized;
      }
    } catch {
      return normalizeCandidatePayload({ candidate });
    }
    return null;
  }

  return normalizeCandidatePayload(candidate);
};

export const normalizeRuntimeError = (
  fallback: string,
  error: unknown
): string => {
  if (!(error instanceof Error)) {
    return fallback;
  }
  const rawMessage = error.message.trim();
  if (rawMessage.length === 0) {
    return fallback;
  }

  const lowerMessage = rawMessage.toLowerCase();
  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("notallowed") ||
    lowerMessage.includes("denied")
  ) {
    return "Microphone/camera permission denied. Check app/browser permissions and retry.";
  }
  if (
    lowerMessage.includes("device not found") ||
    lowerMessage.includes("notfound") ||
    lowerMessage.includes("requested device not found")
  ) {
    return "No media input device available on this device.";
  }
  if (lowerMessage.includes("not supported") || lowerMessage.includes("unsupported")) {
    return "WebRTC is not supported in this runtime.";
  }
  return rawMessage;
};
