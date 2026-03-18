export const CALL_ROUTE_CONFIG = {
  detailsPathname: "/(app)/calls/[callId]",
  paramCallId: "callId"
} as const;

export const CALL_TIMEOUTS_MS = {
  outgoingRing: 45_000,
  connecting: 20_000,
  endedDismiss: 1_500
} as const;

export const CALL_FEATURE_FLAGS = {
  videoEnabled: true,
  incomingCallPromptEnabled: true,
  autoNavigateIncomingCallInForeground: false,
  debugLogsEnabled: __DEV__
} as const;

export const SIGNALING_EVENT_MAP = {
  outgoingStart: "call_invite",
  outgoingAccept: "call_accept",
  outgoingDecline: "call_reject",
  outgoingEnd: "call_end",
  outgoingSignal: "call_signal",
  incomingInviteAck: "call_invite_ack",
  incomingCall: "incoming_call",
  incomingAccepted: "call_accepted",
  incomingDeclined: "call_rejected",
  incomingEnded: "call_ended",
  incomingSignal: "call_signal",
  incomingError: "error"
} as const;
